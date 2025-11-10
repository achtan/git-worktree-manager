#!/usr/bin/env node

/**
 * wt - Create new worktree with branch
 *
 * Usage: wt <branch-name> [base-branch]
 *
 * Creates a new Git worktree for the specified branch.
 */

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { join } from 'node:path'
import {
  getRepoName,
  getDefaultBranch,
  branchExists,
  ensureDir,
  createWorktree,
} from '../utils/git.js'

const program = new Command()

program
  .name('wt')
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

      // Stop spinner before success message
      spinner.stop()

      // Success message
      console.log(chalk.green(`✓ Created worktree for branch '${branchName}'`))
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

program.parse()
