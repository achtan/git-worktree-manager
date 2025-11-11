/**
 * remove - Remove a specific worktree by name
 */

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { basename, dirname, join } from 'node:path'
import {
  listWorktrees,
  getRepoName,
  hasUncommittedChanges,
  removeWorktree,
  deleteBranch,
  hasUnpushedCommits,
} from '../utils/git.js'

export function removeCommand() {
  const cmd = new Command('remove')

  cmd
    .description('Remove a specific worktree and its branch')
    .argument('<name>', 'Worktree name (branch name or directory name)')
    .option('--keep-branch', 'Keep the local branch after removing worktree')
    .option('-f, --force', 'Force removal even if there are uncommitted changes or unpushed commits')
    .action(
      async (
        name: string,
        options: {
          keepBranch?: boolean
          force?: boolean
        },
      ) => {
        const spinner = ora('Finding worktree...').start()

        try {
          // Get repo info
          const repoName = await getRepoName()
          const worktrees = await listWorktrees()

          // Filter to worktrees directory
          const mainWorktree = worktrees[0]
          const worktreesDir = join(dirname(mainWorktree.path), `${repoName}-worktrees`)
          const filteredWorktrees = worktrees.filter((wt) => wt.path.includes(worktreesDir))

          if (filteredWorktrees.length === 0) {
            spinner.stop()
            console.log(chalk.yellow(`No worktrees found in ${worktreesDir}`))
            return
          }

          // Smart matching: try branch name first, then directory name
          let matchedWorktree = filteredWorktrees.find((wt) => wt.branch === name)

          if (!matchedWorktree) {
            // Try matching by directory name
            matchedWorktree = filteredWorktrees.find((wt) => basename(wt.path) === name)
          }

          if (!matchedWorktree) {
            spinner.stop()
            console.error(chalk.red(`Error: No worktree found matching '${name}'`))
            console.log(
              chalk.gray(`\nRun 'wt list' to see available worktrees`),
            )
            process.exit(1)
          }

          const worktreePath = matchedWorktree.path
          const worktreeDirname = basename(worktreePath)
          const branch = matchedWorktree.branch || 'unknown'

          // Check for uncommitted changes
          spinner.text = 'Checking for uncommitted changes...'
          const uncommitted = await hasUncommittedChanges(worktreePath)

          if (uncommitted && !options.force) {
            spinner.stop()
            console.error(chalk.red(`Error: Worktree '${worktreeDirname}' has uncommitted changes`))
            console.log(chalk.yellow('Use --force to remove anyway'))
            process.exit(1)
          }

          // Check for unpushed commits (only if we're going to delete the branch)
          let hasUnpushed = false
          let noRemote = false
          if (!options.keepBranch && branch && branch !== 'unknown') {
            spinner.text = 'Checking for unpushed commits...'
            const pushStatus = await hasUnpushedCommits(branch)
            hasUnpushed = pushStatus.hasUnpushed
            noRemote = pushStatus.noRemote

            if ((hasUnpushed || noRemote) && !options.force) {
              spinner.stop()
              if (hasUnpushed) {
                console.error(
                  chalk.red(`Error: Branch '${branch}' has unpushed commits`),
                )
              } else {
                console.error(
                  chalk.red(`Error: Branch '${branch}' has no remote tracking branch`),
                )
              }
              console.log(chalk.yellow('Use --force to delete anyway, or --keep-branch to preserve the branch'))
              process.exit(1)
            }
          }

          spinner.stop()

          // Show warnings if forcing
          if (options.force) {
            if (uncommitted) {
              console.log(
                chalk.yellow(`⚠ Warning: Removing worktree with uncommitted changes`),
              )
            }
            if (hasUnpushed && !options.keepBranch) {
              console.log(
                chalk.yellow(`⚠ Warning: Deleting branch with unpushed commits`),
              )
            }
            if (noRemote && !options.keepBranch) {
              console.log(
                chalk.yellow(`⚠ Warning: Deleting branch with no remote tracking`),
              )
            }
          }

          // Remove worktree
          console.log(chalk.bold(`Removing worktree: ${worktreeDirname}`))
          console.log(chalk.gray(`  Path: ${worktreePath}`))
          console.log(chalk.gray(`  Branch: ${branch}`))
          console.log()

          spinner.text = 'Removing worktree...'
          spinner.start()

          await removeWorktree(worktreePath)

          spinner.stop()
          console.log(chalk.green(`✓ Removed worktree: ${worktreeDirname}`))

          // Delete branch by default (unless --keep-branch)
          if (!options.keepBranch && branch && branch !== 'unknown') {
            try {
              await deleteBranch(branch, true)
              console.log(chalk.green(`✓ Deleted branch: ${branch}`))
            } catch (error) {
              console.log(chalk.yellow(`⚠ Could not delete branch: ${branch}`))
              if (error instanceof Error) {
                console.log(chalk.gray(`  ${error.message}`))
              }
            }
          } else if (options.keepBranch) {
            console.log(chalk.gray(`Branch '${branch}' kept`))
          }

          console.log()
          console.log(chalk.gray("Run 'wt list' to see remaining worktrees"))
        } catch (error) {
          spinner.stop()
          if (error instanceof Error) {
            console.error(chalk.red(`Error: ${error.message}`))
          } else {
            console.error(chalk.red('An unknown error occurred'))
          }
          process.exit(1)
        }
      },
    )

  return cmd
}
