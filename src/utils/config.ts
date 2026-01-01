/**
 * Config utilities
 *
 * Loads and parses .wtrc.json configuration file for worktree settings.
 */

import { readFile, copyFile, symlink, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { spawn } from 'node:child_process'
import { globby } from 'globby'
import { z } from 'zod'

/**
 * Zod schema for .wtrc.json validation
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

const CONFIG_FILENAME = '.wtrc.json'

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
 * Load configuration from .wtrc.json in main worktree
 * Returns defaults if config file not found
 * Throws ConfigValidationError if config exists but is invalid
 */
export async function loadConfig(mainWorktreePath: string): Promise<LoadConfigResult> {
  const defaults = getDefaults()
  const configPath = join(mainWorktreePath, CONFIG_FILENAME)

  try {
    const content = await readFile(configPath, 'utf-8')
    let parsed: unknown

    try {
      parsed = JSON.parse(content)
    } catch (jsonError) {
      throw new ConfigValidationError(
        `Invalid JSON in ${CONFIG_FILENAME}: ${(jsonError as Error).message}`,
        configPath
      )
    }

    const result = WtConfigSchema.safeParse(parsed)

    if (!result.success) {
      throw new ConfigValidationError(
        formatZodErrors(result.error),
        configPath,
        result.error
      )
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
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { config: defaults, source: 'defaults' }
    }

    // Re-throw ConfigValidationError as-is
    if (error instanceof ConfigValidationError) {
      throw error
    }

    throw error
  }
}

/**
 * Error thrown when config file exists but is invalid
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly configPath: string,
    public readonly zodError?: z.ZodError
  ) {
    super(message)
    this.name = 'ConfigValidationError'
  }
}

/**
 * Format Zod errors into a readable string
 */
function formatZodErrors(error: z.ZodError): string {
  const lines = error.issues.map(issue => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
    return `  - ${path}: ${issue.message}`
  })
  return `Invalid ${CONFIG_FILENAME}:\n${lines.join('\n')}`
}

/**
 * Template variables for config value substitution
 */
export interface TemplateVariables {
  PATH: string    // Full worktree path
  BRANCH: string  // Original branch name (e.g., "feature/auth")
  DIR: string     // Directory name with dashes (e.g., "feature-auth")
  REPO: string    // Repository name
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
    postCreate: config.postCreate.map(cmd => resolveTemplate(cmd, vars)),
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
      const filesToCopy = await globby(copyPatterns, {
        cwd: mainWorktreePath,
        dot: true,
        onlyFiles: true,
      })

      for (const file of filesToCopy) {
        const sourcePath = join(mainWorktreePath, file)
        const targetPath = join(worktreePath, file)

        try {
          await mkdir(dirname(targetPath), { recursive: true })
          await copyFile(sourcePath, targetPath)
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
      const filesToSymlink = await globby(symlinkPatterns, {
        cwd: mainWorktreePath,
        dot: true,
        onlyFiles: true,
      })

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
      spawn(cmd, {
        cwd: worktreePath,
        shell: true,
        detached: true,
        stdio: 'ignore',
      }).unref()
      executed.push(command)
    } else {
      // Blocking command - wait for completion
      try {
        await new Promise<void>((resolve, reject) => {
          const child = spawn(command, {
            cwd: worktreePath,
            shell: true,
            stdio: 'inherit',
          })

          child.on('close', (code) => {
            if (code === 0) {
              resolve()
            } else {
              reject(new Error(`Command exited with code ${code}`))
            }
          })

          child.on('error', (error) => {
            reject(error)
          })
        })
        executed.push(command)
      } catch (error) {
        return {
          executed,
          failed: { command, error: (error as Error).message },
        }
      }
    }
  }

  return { executed }
}
