/**
 * remove - Remove a specific worktree by name
 */

import { Command } from 'commander'
import pc from 'picocolors'
import { select } from '@clack/prompts'
import { createSpinner } from '../utils/spinner.js'
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
        const spinner = createSpinner()
        spinner.start('Finding worktree...')

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
            console.log(pc.yellow(`No worktrees found in ${worktreesDir}`))
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
            console.error(pc.red(`Error: No worktree found matching '${name}'`))
            console.log(
              pc.gray(`\nRun 'wt list' to see available worktrees`),
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
          console.log(pc.bold(`Worktree: ${worktreeDirname}`))
          console.log(pc.gray(`  Path: ${worktreePath}`))
          console.log(pc.gray(`  Branch: ${branch}`))
          console.log()

          // Handle uncommitted changes interactively (unless --force)
          if (uncommitted && !options.force) {
            const changes = await getWorktreeChanges(worktreePath)

            console.log(pc.yellow('⚠ Uncommitted changes detected:'))
            console.log()

            if (changes.modified.length > 0) {
              console.log(pc.bold('Modified:'))
              for (const line of changes.modified) {
                console.log(`  ${line}`)
              }
              console.log()
            }

            if (changes.untracked.length > 0) {
              console.log(pc.bold('Untracked:'))
              for (const line of changes.untracked) {
                console.log(`  ${line}`)
              }
              console.log()
            }

            // Interactive prompt
            let showedDiff = false
            let shouldRemove = false

            while (!shouldRemove) {
              const options = showedDiff
                ? [
                    { label: 'Discard changes and remove', value: 'remove' as const },
                    { label: 'Abort', value: 'abort' as const },
                  ]
                : [
                    { label: 'Show diff', value: 'diff' as const },
                    { label: 'Discard changes and remove', value: 'remove' as const },
                    { label: 'Abort', value: 'abort' as const },
                  ]

              const action = await select({
                message: 'What would you like to do?',
                options,
              })

              if (typeof action === 'symbol') {
                console.log(pc.yellow('Aborted.'))
                return
              }

              if (action === 'abort') {
                console.log(pc.yellow('Aborted.'))
                return
              }

              if (action === 'diff') {
                const diff = await getGitDiff(worktreePath)
                console.log()
                console.log('─'.repeat(60))
                if (diff) {
                  console.log(diff)
                } else {
                  console.log(pc.gray('No diff available (only untracked files)'))
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
              console.log(pc.yellow(`⚠ Warning: Branch '${branch}' has unpushed commits`))
            } else {
              console.log(pc.yellow(`⚠ Warning: Branch '${branch}' has no remote tracking branch`))
            }

            const action = await select({
              message: 'What would you like to do?',
              options: [
                { label: 'Delete branch anyway', value: 'delete' as const },
                { label: 'Keep branch (only remove worktree)', value: 'keep' as const },
                { label: 'Abort', value: 'abort' as const },
              ],
            })

            if (typeof action === 'symbol') {
              console.log(pc.yellow('Aborted.'))
              return
            }

            if (action === 'abort') {
              console.log(pc.yellow('Aborted.'))
              return
            }

            if (action === 'keep') {
              options.keepBranch = true
            }
          }

          // Show warnings if forcing
          if (options.force) {
            if (uncommitted) {
              console.log(pc.yellow(`⚠ Warning: Removing worktree with uncommitted changes`))
            }
            if (hasUnpushed && !options.keepBranch) {
              console.log(pc.yellow(`⚠ Warning: Deleting branch with unpushed commits`))
            }
            if (noRemote && !options.keepBranch) {
              console.log(pc.yellow(`⚠ Warning: Deleting branch with no remote tracking`))
            }
          }

          // Remove worktree
          console.log()
          spinner.start('Removing worktree...')

          try {
            await removeWorktree(worktreePath, true)
          } catch {
            // Fallback to force remove if git worktree remove fails (e.g., untracked files)
            spinner.text = 'Force removing directory...'
            await forceRemoveDirectory(worktreePath)
            await pruneWorktrees()
          }

          spinner.stop()
          console.log(pc.green(`✓ Removed worktree: ${worktreeDirname}`))

          // Delete branch by default (unless --keep-branch)
          if (!options.keepBranch && branch && branch !== 'unknown') {
            try {
              await deleteBranch(branch, true)
              console.log(pc.green(`✓ Deleted branch: ${branch}`))
            } catch (error) {
              console.log(pc.yellow(`⚠ Could not delete branch: ${branch}`))
              if (error instanceof Error) {
                console.log(pc.gray(`  ${error.message}`))
              }
            }
          } else if (options.keepBranch) {
            console.log(pc.gray(`Branch '${branch}' kept`))
          }

          console.log()
          console.log(pc.gray("Run 'wt list' to see remaining worktrees"))
        } catch (error) {
          spinner.stop()
          if (error instanceof Error) {
            console.error(pc.red(`Error: ${error.message}`))
          } else {
            console.error(pc.red('An unknown error occurred'))
          }
          process.exit(1)
        }
      },
    )

  return cmd
}
