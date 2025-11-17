/**
 * new - Create new worktree with branch
 */

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { join, dirname } from 'node:path'
import { symlink, copyFile, mkdir, readFile, cp, readdir } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { execa } from 'execa'
import {
  getRepoName,
  getDefaultBranch,
  branchExists,
  ensureDir,
  createWorktree,
} from '../utils/git.js'

export function newCommand() {
  const cmd = new Command('new')

  cmd
    .description('Create new worktree with branch')
    .argument('<branch-name>', 'Name of the branch to create worktree for')
    .argument('[base-branch]', 'Base branch to create from (default: auto-detected)')
    .action(async (branchName: string, baseBranch?: string) => {
      const spinner = ora()
      try {
        // Check if branch already exists
        if (await branchExists(branchName)) {
          console.error(chalk.red(`Error: Branch '${branchName}' already exists locally`))
          process.exit(1)
        }

        // Start spinner after validation passes
        spinner.start('Creating worktree...')

        // Get repo name
        const repoName = await getRepoName()

        // Construct worktree directory path
        const worktreeBaseDir = join('..', `${repoName}-worktrees`)

        // Convert branch name slashes to dashes for directory name
        const dirName = branchName.replace(/\//g, '-')
        const worktreePath = join(worktreeBaseDir, dirName)

        // Get base branch (use provided or auto-detect)
        const base = baseBranch || (await getDefaultBranch())

        // Ensure worktrees directory exists
        await ensureDir(worktreeBaseDir)

        // Create the worktree
        await createWorktree(branchName, worktreePath, base)

        // Copy .env file if it exists in main worktree
        let envSymlinked = false
        let settingsCopied = false
        let ideaSettingsCopied = false
        try {
          const { stdout: mainWorktreeRoot } = await execa('git', [
            'rev-parse',
            '--show-toplevel',
          ])
          const mainRoot = mainWorktreeRoot.trim()

          // Symlink .env file
          const sourceEnvPath = join(mainRoot, '.env')
          const targetEnvPath = join(worktreePath, '.env')

          if (existsSync(sourceEnvPath)) {
            await symlink(sourceEnvPath, targetEnvPath)
            envSymlinked = true
          }

          // Copy .claude/settings.local.json file
          const sourceSettingsPath = join(mainRoot, '.claude', 'settings.local.json')
          const targetSettingsPath = join(worktreePath, '.claude', 'settings.local.json')

          if (existsSync(sourceSettingsPath)) {
            await mkdir(dirname(targetSettingsPath), { recursive: true })
            await copyFile(sourceSettingsPath, targetSettingsPath)
            settingsCopied = true
          }

          // Copy WebStorm .idea settings (whitelisted files only)
          const sourceIdeaPath = join(mainRoot, '.idea')
          const targetIdeaPath = join(worktreePath, '.idea')

          if (existsSync(sourceIdeaPath)) {
            // Ensure target .idea directory exists
            await mkdir(targetIdeaPath, { recursive: true })

            // Whitelisted directories to copy
            const dirsTocp = ['runConfigurations', 'codeStyles', 'inspectionProfiles', 'scopes']
            for (const dir of dirsTocp) {
              const sourceDir = join(sourceIdeaPath, dir)
              const targetDir = join(targetIdeaPath, dir)
              if (existsSync(sourceDir) && statSync(sourceDir).isDirectory()) {
                await cp(sourceDir, targetDir, { recursive: true })
                ideaSettingsCopied = true
              }
            }

            // Whitelisted files to copy
            const filesToCopy = ['modules.xml', 'vcs.xml', 'encodings.xml', 'misc.xml']
            for (const file of filesToCopy) {
              const sourceFile = join(sourceIdeaPath, file)
              const targetFile = join(targetIdeaPath, file)
              if (existsSync(sourceFile)) {
                await copyFile(sourceFile, targetFile)
                ideaSettingsCopied = true
              }
            }

            // Copy all .iml files
            const ideaFiles = await readdir(sourceIdeaPath)
            for (const file of ideaFiles) {
              if (file.endsWith('.iml')) {
                const sourceFile = join(sourceIdeaPath, file)
                const targetFile = join(targetIdeaPath, file)
                if (existsSync(sourceFile)) {
                  await copyFile(sourceFile, targetFile)
                  ideaSettingsCopied = true
                }
              }
            }
          }
        } catch (error) {
          // Silently skip if files don't exist or operations fail
        }

        // Check for and execute post-worktree-created hook
        try {
          const packageJsonPath = join(worktreePath, 'package.json')
          if (existsSync(packageJsonPath)) {
            const packageJsonContent = await readFile(packageJsonPath, 'utf-8')
            const packageJson = JSON.parse(packageJsonContent)

            const hookScript = packageJson.scripts?.['post-worktree-created']
            if (hookScript) {
              spinner.stop()
              console.log(chalk.blue(`→ Running post-worktree-created: ${hookScript}`))
              spinner.start('Executing hook...')

              await execa('npm', ['run', 'post-worktree-created'], {
                cwd: worktreePath,
              })

              spinner.stop()
              console.log(chalk.green('✓ Post-worktree hook completed'))
            }
          }
        } catch (error) {
          spinner.stop()
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.log(chalk.yellow(`⚠ Warning: Post-worktree hook failed: ${errorMessage}`))
        }

        // Stop spinner before success message (if not already stopped)
        spinner.stop()

        // Success message
        console.log(chalk.green(`✓ Created worktree for branch '${branchName}'`))
        if (envSymlinked) {
          console.log(chalk.gray('  Symlinked .env from main worktree'))
        }
        if (settingsCopied) {
          console.log(chalk.gray('  Copied .claude/settings.local.json from main worktree'))
        }
        if (ideaSettingsCopied) {
          console.log(chalk.gray('  Copied WebStorm settings from main worktree'))
        }
        console.log()
        console.log(chalk.cyan(`cd ${worktreePath}`))
      } catch (error) {
        spinner.stop()
        if (error instanceof Error) {
          console.error(chalk.red(`Error: ${error.message}`))
        } else {
          console.error(chalk.red('An unknown error occurred'))
        }
        process.exit(1)
      }
    })

  return cmd
}
