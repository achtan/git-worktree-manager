/**
 * Config utilities
 *
 * Loads and parses .wtrc.js configuration file for worktree settings.
 */

import { mkdir, symlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'

/**
 * Expand glob patterns with negation support
 * Patterns starting with ! are negations
 */
async function expandGlobs(patterns: string[], cwd: string): Promise<string[]> {
  const positive = patterns.filter((p) => !p.startsWith('!'))
  const negative = patterns.filter((p) => p.startsWith('!')).map((p) => p.slice(1))

  const results: string[] = []
  for (const pattern of positive) {
    const glob = new Bun.Glob(pattern)
    for await (const file of glob.scan({ cwd, dot: true })) {
      results.push(file)
    }
  }

  // Dedupe
  const unique = [...new Set(results)]

  // Filter out negated patterns
  if (negative.length === 0) return unique

  const negativeGlobs = negative.map((p) => new Bun.Glob(p))
  return unique.filter((file) => !negativeGlobs.some((glob) => glob.match(file)))
}

/**
 * Zod schema for .wtrc.js validation
 */
const WtConfigSchema = z.object({
  worktreePath: z.string().optional(),
  copy: z.array(z.string()).optional(),
  symlink: z.array(z.string()).optional(),
  postCreate: z.array(z.string()).optional(),
})

/**
 * Worktree configuration
 */
export interface WtConfig {
  worktreePath: string
  copy: string[]
  symlink: string[]
  postCreate: string[]
}

/**
 * Result of loading configuration
 */
export interface LoadConfigResult {
  config: WtConfig
  source: 'file' | 'defaults'
}

const CONFIG_FILENAME = '.wtrc.js'

/**
 * Get default configuration
 */
export function getDefaults(): WtConfig {
  return {
    worktreePath: '$REPO-worktrees/$DIR',
    copy: [],
    symlink: [],
    postCreate: [],
  }
}

/**
 * Load configuration from .wtrc.js in main worktree
 * Returns defaults if config file not found
 * Throws ConfigValidationError if config exists but is invalid
 */
export async function loadConfig(mainWorktreePath: string): Promise<LoadConfigResult> {
  const defaults = getDefaults()
  const configPath = join(mainWorktreePath, CONFIG_FILENAME)

  try {
    const file = Bun.file(configPath)
    if (!(await file.exists())) {
      return { config: defaults, source: 'defaults' }
    }

    const module = await import(configPath)
    const config = module.default ?? module

    const result = WtConfigSchema.safeParse(config)
    if (!result.success) {
      throw new ConfigValidationError(formatZodErrors(result.error), configPath, result.error)
    }

    const validated = result.data
    return {
      config: {
        worktreePath: validated.worktreePath ?? defaults.worktreePath,
        copy: validated.copy ?? defaults.copy,
        symlink: validated.symlink ?? defaults.symlink,
        postCreate: validated.postCreate ?? defaults.postCreate,
      },
      source: 'file',
    }
  } catch (error) {
    if (error instanceof ConfigValidationError) throw error
    throw new ConfigValidationError(
      `Failed to load ${CONFIG_FILENAME}: ${(error as Error).message}`,
      configPath,
    )
  }
}

/**
 * Error thrown when config file exists but is invalid
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly configPath: string,
    public readonly zodError?: z.ZodError,
  ) {
    super(message)
    this.name = 'ConfigValidationError'
  }
}

/**
 * Format Zod errors into a readable string
 */
function formatZodErrors(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
    return `  - ${path}: ${issue.message}`
  })
  return `Invalid .wtrc.js:\n${lines.join('\n')}`
}

/**
 * Template variables for config value substitution
 */
export interface TemplateVariables {
  PATH: string // Full worktree path
  BRANCH: string // Original branch name (e.g., "feature/auth")
  DIR: string // Directory name with dashes (e.g., "feature-auth")
  REPO: string // Repository name
}

/**
 * Resolve template variables in a string
 * Replaces $PATH, $BRANCH, $DIR, $REPO with actual values
 */
export function resolveTemplate(template: string, vars: TemplateVariables): string {
  return template
    .replace(/\$PATH\b/g, vars.PATH)
    .replace(/\$BRANCH\b/g, vars.BRANCH)
    .replace(/\$DIR\b/g, vars.DIR)
    .replace(/\$REPO\b/g, vars.REPO)
}

/**
 * Resolve template variables in config
 * Applies to worktreePath and postCreate commands
 * copy and symlink patterns are NOT resolved (they're relative to main worktree)
 */
export function resolveConfig(config: WtConfig, vars: TemplateVariables): WtConfig {
  return {
    worktreePath: resolveTemplate(config.worktreePath, vars),
    copy: config.copy,
    symlink: config.symlink,
    postCreate: config.postCreate.map((cmd) => resolveTemplate(cmd, vars)),
  }
}

/**
 * Options for copying config files
 */
export interface CopyConfigFilesOptions {
  mainWorktreePath: string
  worktreePath: string
  copyPatterns: string[]
  symlinkPatterns: string[]
}

/**
 * Copy and symlink files based on glob patterns
 * Patterns are gitignore-style: `!` prefix for negation
 * On failure: warn but continue (don't fail command)
 */
export async function copyConfigFiles(options: CopyConfigFilesOptions): Promise<{
  copied: string[]
  symlinked: string[]
  warnings: string[]
}> {
  const { mainWorktreePath, worktreePath, copyPatterns, symlinkPatterns } = options
  const copied: string[] = []
  const symlinked: string[] = []
  const warnings: string[] = []

  // Process copy patterns
  if (copyPatterns.length > 0) {
    try {
      const filesToCopy = await expandGlobs(copyPatterns, mainWorktreePath)

      for (const file of filesToCopy) {
        const sourcePath = join(mainWorktreePath, file)
        const targetPath = join(worktreePath, file)

        try {
          await mkdir(dirname(targetPath), { recursive: true })
          await Bun.write(targetPath, Bun.file(sourcePath))
          copied.push(file)
        } catch (error) {
          warnings.push(`Failed to copy ${file}: ${(error as Error).message}`)
        }
      }
    } catch (error) {
      warnings.push(`Failed to process copy patterns: ${(error as Error).message}`)
    }
  }

  // Process symlink patterns
  if (symlinkPatterns.length > 0) {
    try {
      const filesToSymlink = await expandGlobs(symlinkPatterns, mainWorktreePath)

      for (const file of filesToSymlink) {
        const sourcePath = join(mainWorktreePath, file)
        const targetPath = join(worktreePath, file)

        try {
          await mkdir(dirname(targetPath), { recursive: true })
          await symlink(sourcePath, targetPath)
          symlinked.push(file)
        } catch (error) {
          warnings.push(`Failed to symlink ${file}: ${(error as Error).message}`)
        }
      }
    } catch (error) {
      warnings.push(`Failed to process symlink patterns: ${(error as Error).message}`)
    }
  }

  return { copied, symlinked, warnings }
}

/**
 * Options for running post-create commands
 */
export interface RunPostCreateCommandsOptions {
  worktreePath: string
  commands: string[]
  onCommand?: (command: string) => void
}

/**
 * Run post-create commands in the worktree directory
 * Commands ending with ` &` are spawned detached (don't wait)
 * Other commands run blocking and stop on first failure
 */
export async function runPostCreateCommands(options: RunPostCreateCommandsOptions): Promise<{
  executed: string[]
  failed?: { command: string; error: string }
}> {
  const { worktreePath, commands, onCommand } = options
  const executed: string[] = []

  for (const command of commands) {
    onCommand?.(command)

    if (command.endsWith(' &')) {
      // Detached command - spawn and don't wait
      const cmd = command.slice(0, -2).trim()
      Bun.spawn(['sh', '-c', cmd], {
        cwd: worktreePath,
        stdout: 'ignore',
        stderr: 'ignore',
        stdin: 'ignore',
      })
      executed.push(command)
    } else {
      // Blocking command - wait for completion
      const proc = Bun.spawn(['sh', '-c', command], {
        cwd: worktreePath,
        stdout: 'inherit',
        stderr: 'inherit',
        stdin: 'inherit',
      })

      const exitCode = await proc.exited
      if (exitCode !== 0) {
        return {
          executed,
          failed: { command, error: `Command exited with code ${exitCode}` },
        }
      }
      executed.push(command)
    }
  }

  return { executed }
}
