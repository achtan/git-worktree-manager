/**
 * remove - Remove a specific worktree by name
 */

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { select } from '@inquirer/prompts'
import { basename, dirname, join } from 'node:path'
import {
  listWorktrees,
  getRepoName,
  hasUncommittedChanges,
  removeWorktree,
  deleteBranch,
  hasUnpushedCommits,
  getWorktreeChanges,
  getGitDiff,
  forceRemoveDirectory,
  pruneWorktrees,
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

          // Check for unpushed commits (only if we're going to delete the branch)
          let hasUnpushed = false
          let noRemote = false
          if (!options.keepBranch && branch && branch !== 'unknown') {
            spinner.text = 'Checking for unpushed commits...'
            const pushStatus = await hasUnpushedCommits(branch)
            hasUnpushed = pushStatus.hasUnpushed
            noRemote = pushStatus.noRemote
          }

          spinner.stop()

          // Display worktree info
          console.log(chalk.bold(`Worktree: ${worktreeDirname}`))
          console.log(chalk.gray(`  Path: ${worktreePath}`))
          console.log(chalk.gray(`  Branch: ${branch}`))
          console.log()

          // Handle uncommitted changes interactively (unless --force)
          if (uncommitted && !options.force) {
            const changes = await getWorktreeChanges(worktreePath)

            console.log(chalk.yellow('⚠ Uncommitted changes detected:'))
            console.log()

            if (changes.modified.length > 0) {
              console.log(chalk.bold('Modified:'))
              for (const line of changes.modified) {
                console.log(`  ${line}`)
              }
              console.log()
            }

            if (changes.untracked.length > 0) {
              console.log(chalk.bold('Untracked:'))
              for (const line of changes.untracked) {
                console.log(`  ${line}`)
              }
              console.log()
            }

            // Interactive prompt
            let showedDiff = false
            let shouldRemove = false

            while (!shouldRemove) {
              const choices = showedDiff
                ? [
                    { name: 'Discard changes and remove', value: 'remove' as const },
                    { name: 'Abort', value: 'abort' as const },
                  ]
                : [
                    { name: 'Show diff', value: 'diff' as const },
                    { name: 'Discard changes and remove', value: 'remove' as const },
                    { name: 'Abort', value: 'abort' as const },
                  ]

              const action = await select({
                message: 'What would you like to do?',
                choices,
              })

              if (action === 'abort') {
                console.log(chalk.yellow('Aborted.'))
                return
              }

              if (action === 'diff') {
                const diff = await getGitDiff(worktreePath)
                console.log()
                console.log('─'.repeat(60))
                if (diff) {
                  console.log(diff)
                } else {
                  console.log(chalk.gray('No diff available (only untracked files)'))
                }
                console.log('─'.repeat(60))
                console.log()
                showedDiff = true
                continue
              }

              if (action === 'remove') {
                shouldRemove = true
              }
            }
          }

          // Show warnings for unpushed commits (unless --force)
          if ((hasUnpushed || noRemote) && !options.keepBranch && !options.force) {
            if (hasUnpushed) {
              console.log(chalk.yellow(`⚠ Warning: Branch '${branch}' has unpushed commits`))
            } else {
              console.log(chalk.yellow(`⚠ Warning: Branch '${branch}' has no remote tracking branch`))
            }

            const action = await select({
              message: 'What would you like to do?',
              choices: [
                { name: 'Delete branch anyway', value: 'delete' as const },
                { name: 'Keep branch (only remove worktree)', value: 'keep' as const },
                { name: 'Abort', value: 'abort' as const },
              ],
            })

            if (action === 'abort') {
              console.log(chalk.yellow('Aborted.'))
              return
            }

            if (action === 'keep') {
              options.keepBranch = true
            }
          }

          // Show warnings if forcing
          if (options.force) {
            if (uncommitted) {
              console.log(chalk.yellow(`⚠ Warning: Removing worktree with uncommitted changes`))
            }
            if (hasUnpushed && !options.keepBranch) {
              console.log(chalk.yellow(`⚠ Warning: Deleting branch with unpushed commits`))
            }
            if (noRemote && !options.keepBranch) {
              console.log(chalk.yellow(`⚠ Warning: Deleting branch with no remote tracking`))
            }
          }

          // Remove worktree
          console.log()
          spinner.text = 'Removing worktree...'
          spinner.start()

          try {
            await removeWorktree(worktreePath, true)
          } catch {
            // Fallback to force remove if git worktree remove fails (e.g., untracked files)
            spinner.text = 'Force removing directory...'
            await forceRemoveDirectory(worktreePath)
            await pruneWorktrees()
          }

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
