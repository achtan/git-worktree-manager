/**
 * new - Create new worktree with branch
 */

import { Command } from 'commander'
import pc from 'picocolors'
import { createSpinner } from '../utils/spinner.js'
import { join, dirname, basename } from 'node:path'
import {
  getMainWorktreePath,
  getDefaultBranch,
  branchExists,
  ensureDir,
  createWorktree,
  fetchOrigin,
} from '../utils/git.js'
import { copyToClipboard } from '../utils/clipboard.js'
import {
  loadConfig,
  resolveTemplate,
  copyConfigFiles,
  runPostCreateCommands,
  type TemplateVariables,
} from '../utils/config.js'

export function newCommand() {
  const cmd = new Command('new')

  cmd
    .description('Create new worktree with branch')
    .argument('<branch-name>', 'Name of the branch to create worktree for')
    .argument('[base-branch]', 'Base branch to create from (default: auto-detected)')
    .action(async (branchName: string, baseBranch?: string) => {
      const spinner = createSpinner()
      try {
        // Check if branch already exists
        if (await branchExists(branchName)) {
          console.error(pc.red(`Error: Branch '${branchName}' already exists locally`))
          process.exit(1)
        }

        // Start spinner after validation passes
        spinner.start('Creating worktree...')

        // Get main worktree path and derive repo name
        const mainWorktreePath = await getMainWorktreePath()
        const repoName = basename(mainWorktreePath)

        // Load config from .wtrc.json (throws if config exists but is invalid)
        const { config } = await loadConfig(mainWorktreePath)

        // Convert branch name slashes to dashes for directory name
        const dirName = branchName.replace(/\//g, '-')

        // Build template variables
        const templateVars: TemplateVariables = {
          PATH: '', // Will be set after worktreePath is resolved
          BRANCH: branchName,
          DIR: dirName,
          REPO: repoName,
        }

        // Resolve worktree path from config template
        const resolvedWorktreePath = resolveTemplate(config.worktreePath, templateVars)
        const worktreePath = join(dirname(mainWorktreePath), resolvedWorktreePath)
        const worktreeBaseDir = dirname(worktreePath)

        // Update PATH variable now that we have the full path
        templateVars.PATH = worktreePath

        // Get base branch (use provided or auto-detect)
        const base = baseBranch || (await getDefaultBranch())

        // Fetch latest from origin
        let useRemoteBase = true
        try {
          spinner.text = 'Fetching latest from origin...'
          await fetchOrigin()
        } catch {
          spinner.stop()
          console.log(pc.yellow(`⚠ Warning: Could not fetch from origin, using local '${base}'`))
          spinner.start('Creating worktree...')
          useRemoteBase = false
        }

        // Ensure worktrees directory exists
        await ensureDir(worktreeBaseDir)

        // Create the worktree (use origin/<base> if fetch succeeded)
        const actualBase = useRemoteBase ? `origin/${base}` : base
        await createWorktree(branchName, worktreePath, actualBase)
        spinner.stop()
        console.log(pc.green(`✓ Created worktree for branch '${branchName}'`))

        // Copy/symlink files based on config
        if (config.copy.length > 0 || config.symlink.length > 0) {
          const result = await copyConfigFiles({
            mainWorktreePath,
            worktreePath,
            copyPatterns: config.copy,
            symlinkPatterns: config.symlink,
          })

          if (result.copied.length > 0) {
            console.log(pc.gray(`  Copied ${result.copied.length} file(s) from main worktree`))
          }
          if (result.symlinked.length > 0) {
            console.log(pc.gray(`  Symlinked ${result.symlinked.length} file(s) from main worktree`))
          }
          for (const warning of result.warnings) {
            console.log(pc.yellow(`  ⚠ ${warning}`))
          }
        }

        // Run post-create commands
        if (config.postCreate.length > 0) {
          // Resolve template variables in commands
          const resolvedCommands = config.postCreate.map(cmd => resolveTemplate(cmd, templateVars))

          const result = await runPostCreateCommands({
            worktreePath,
            commands: resolvedCommands,
            onCommand: (command) => {
              console.log(pc.blue(`→ ${command}`))
            },
          })

          if (result.failed) {
            console.log(pc.yellow(`⚠ Command failed: ${result.failed.error}`))
          } else if (result.executed.length > 0) {
            console.log(pc.green('✓ Post-create commands completed'))
          }
        }

        // Print final cd command and copy path to clipboard
        console.log()
        const copied = await copyToClipboard(worktreePath)
        if (copied) {
          console.log(pc.cyan(`cd ${worktreePath}`), pc.gray('(path copied to clipboard)'))
        } else {
          console.log(pc.cyan(`cd ${worktreePath}`))
        }
      } catch (error) {
        spinner.stop()
        if (error instanceof Error) {
          console.error(pc.red(`Error: ${error.message}`))
        } else {
          console.error(pc.red('An unknown error occurred'))
        }
        process.exit(1)
      }
    })

  return cmd
}
