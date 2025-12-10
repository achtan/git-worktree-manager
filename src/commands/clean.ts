/**
 * clean - Remove merged/closed worktrees
 */

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { checkbox } from '@inquirer/prompts'
import { basename, dirname, join } from 'node:path'
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs'
import { execa } from 'execa'
import {
  listWorktrees,
  getRepoName,
  getRemoteUrl,
  hasUncommittedChanges,
  removeWorktree,
  deleteBranch,
  getCurrentWorktreePath,
  isPathInWorktree,
} from '../utils/git.js'
import { getPRStatus, parseGitHubRepo, isGhCliAvailable } from '../utils/github.js'

interface CleanableWorktree {
  path: string
  dirname: string
  branch: string
  prState: 'merged' | 'closed'
  hasUncommittedChanges: boolean
}

interface AbandonedFolder {
  path: string
  dirname: string
  fileCount: number
  folderCount: number
}

interface OrphanWorktree {
  path: string
  dirname: string
  brokenGitdir: string
}

/**
 * Count files and folders in a directory
 */
function countContents(dirPath: string): { fileCount: number; folderCount: number } {
  let fileCount = 0
  let folderCount = 0

  try {
    const entries = readdirSync(dirPath)
    for (const entry of entries) {
      const fullPath = join(dirPath, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        folderCount++
      } else {
        fileCount++
      }
    }
  } catch {
    // If we can't read the directory, return 0s
  }

  return { fileCount, folderCount }
}

/**
 * Find abandoned folders in worktrees directory
 */
function findAbandonedFolders(worktreesDir: string): AbandonedFolder[] {
  const abandoned: AbandonedFolder[] = []

  if (!existsSync(worktreesDir)) {
    return abandoned
  }

  try {
    const entries = readdirSync(worktreesDir)
    for (const entry of entries) {
      const fullPath = join(worktreesDir, entry)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        const gitPath = join(fullPath, '.git')
        if (!existsSync(gitPath)) {
          const { fileCount, folderCount } = countContents(fullPath)
          abandoned.push({
            path: fullPath,
            dirname: entry,
            fileCount,
            folderCount,
          })
        }
      }
    }
  } catch {
    // If we can't read the worktrees directory, return empty array
  }

  return abandoned
}

/**
 * Find orphan worktrees - folders with .git file pointing to non-existent gitdir
 */
function findOrphanWorktrees(worktreesDir: string): OrphanWorktree[] {
  const orphans: OrphanWorktree[] = []

  if (!existsSync(worktreesDir)) {
    return orphans
  }

  try {
    const entries = readdirSync(worktreesDir)
    for (const entry of entries) {
      const fullPath = join(worktreesDir, entry)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        const gitPath = join(fullPath, '.git')
        if (existsSync(gitPath)) {
          const gitStat = statSync(gitPath)
          // Only check .git files (not directories - those are regular repos)
          if (gitStat.isFile()) {
            try {
              const content = readFileSync(gitPath, 'utf-8')
              const match = content.match(/^gitdir:\s*(.+)$/m)
              if (match) {
                const gitdir = match[1].trim()
                if (!existsSync(gitdir)) {
                  orphans.push({
                    path: fullPath,
                    dirname: entry,
                    brokenGitdir: gitdir,
                  })
                }
              }
            } catch {
              // If we can't read the .git file, skip it
            }
          }
        }
      }
    }
  } catch {
    // If we can't read the worktrees directory, return empty array
  }

  return orphans
}

export function cleanCommand() {
  const cmd = new Command('clean')

  cmd
    .description('Remove merged/closed worktrees')
    .option('-d, --dry-run', 'Show what would be removed without actually removing')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(
      async (options: {
        dryRun?: boolean
        force?: boolean
      }) => {
        const spinner = ora()
        try {
          // Check gh CLI availability
          const ghStatus = await isGhCliAvailable()
          if (!ghStatus.available) {
            console.error(chalk.red("Error: 'gh' CLI is required for wt clean"))
            console.log('Install it with: brew install gh')
            process.exit(1)
          }
          if (!ghStatus.authenticated) {
            console.error(chalk.red('Error: gh CLI is not authenticated'))
            console.log('Authenticate with: gh auth login')
            process.exit(1)
          }

          // Start spinner after validation
          spinner.start('Scanning worktrees...')

          // Get repo info
          const repoName = await getRepoName()
          const worktrees = await listWorktrees()

          // Check if GitHub repo
          let githubInfo: { owner: string; repo: string } | null = null
          try {
            const remoteUrl = await getRemoteUrl()
            githubInfo = parseGitHubRepo(remoteUrl)

            if (!githubInfo) {
              console.error(chalk.red('Error: Not a GitHub repository'))
              process.exit(1)
            }
          } catch {
            console.error(chalk.red('Error: No remote repository configured'))
            process.exit(1)
          }

          // Filter worktrees to worktrees directory
          const mainWorktree = worktrees[0]
          const worktreesDir = join(dirname(mainWorktree.path), `${repoName}-worktrees`)
          const filteredWorktrees = worktrees.filter((wt) => wt.path.includes(worktreesDir))

          if (filteredWorktrees.length === 0) {
            spinner.stop()
            console.log(chalk.yellow(`No worktrees found in ${worktreesDir}`))
            return
          }

          // Update spinner for PR checking phase
          spinner.text = 'Checking PR status...'

          // Get current worktree path
          const currentPath = await getCurrentWorktreePath()

          // Gather cleanable worktrees
          const cleanable: CleanableWorktree[] = []

          for (const wt of filteredWorktrees) {
            if (!wt.branch) continue

            // Skip if current worktree
            if (isPathInWorktree(currentPath, wt.path)) {
              continue
            }

            // Get PR status
            try {
              const pr = await getPRStatus(githubInfo.owner, githubInfo.repo, wt.branch)
              if (!pr) continue

              const prState = pr.state
              if (prState === 'merged' || prState === 'closed') {
                const uncommitted = await hasUncommittedChanges(wt.path)
                cleanable.push({
                  path: wt.path,
                  dirname: basename(wt.path),
                  branch: wt.branch,
                  prState,
                  hasUncommittedChanges: uncommitted,
                })
              }
            } catch {
              // Skip if PR status check fails
              continue
            }
          }

          // Filter out worktrees with uncommitted changes
          const skipped = cleanable.filter((w) => w.hasUncommittedChanges)
          const toRemove = cleanable.filter((w) => !w.hasUncommittedChanges)

          // Find abandoned folders and orphan worktrees
          spinner.text = 'Scanning for abandoned folders...'
          const abandonedFolders = findAbandonedFolders(worktreesDir)
          const orphanWorktrees = findOrphanWorktrees(worktreesDir)

          // Stop spinner before displaying results
          spinner.stop()

          if (cleanable.length === 0 && abandonedFolders.length === 0 && orphanWorktrees.length === 0) {
            console.log(chalk.green('✓ No merged/closed worktrees, abandoned folders, or orphan worktrees found'))
            return
          }

          // Build checkbox choices
          type ChoiceValue =
            | { type: 'worktree'; data: CleanableWorktree }
            | { type: 'abandoned'; data: AbandonedFolder }
            | { type: 'orphan'; data: OrphanWorktree }
          const choices: { name: string; value: ChoiceValue; checked: boolean }[] = []

          for (const wt of toRemove) {
            const stateLabel = wt.prState === 'merged' ? chalk.green('MERGED') : chalk.yellow('CLOSED')
            choices.push({
              name: `${wt.dirname} (${stateLabel})`,
              value: { type: 'worktree', data: wt },
              checked: false,
            })
          }

          for (const folder of abandonedFolders) {
            choices.push({
              name: `${folder.dirname} ${chalk.gray('(abandoned)')}`,
              value: { type: 'abandoned', data: folder },
              checked: false,
            })
          }

          for (const orphan of orphanWorktrees) {
            choices.push({
              name: `${orphan.dirname} ${chalk.hex('#FFA500')('(orphan)')}`,
              value: { type: 'orphan', data: orphan },
              checked: false,
            })
          }

          // Show skipped worktrees
          if (skipped.length > 0) {
            console.log(chalk.yellow('⚠ Skipped (uncommitted changes):'))
            for (const wt of skipped) {
              console.log(`  ${wt.dirname} (${wt.branch})`)
            }
            console.log()
          }

          if (choices.length === 0) {
            console.log(chalk.yellow('No worktrees can be removed (all have uncommitted changes)'))
            return
          }

          // Dry run mode
          if (options.dryRun) {
            console.log(chalk.bold('Would remove:'))
            for (const choice of choices) {
              console.log(`  ${choice.name}`)
            }
            return
          }

          // Interactive selection (skip if --force)
          let selectedItems: ChoiceValue[]
          if (options.force) {
            selectedItems = choices.map(c => c.value)
          } else {
            selectedItems = await checkbox({
              message: 'Select worktrees to remove:',
              choices,
            })
          }

          if (selectedItems.length === 0) {
            console.log(chalk.yellow('No worktrees selected'))
            return
          }

          console.log()

          // Remove selected items
          let removed = 0
          let failed = 0
          let abandonedRemoved = 0
          let abandonedFailed = 0
          let orphanRemoved = 0
          let orphanFailed = 0

          const removeSpinner = ora()

          for (const item of selectedItems) {
            if (item.type === 'worktree') {
              const wt = item.data
              removeSpinner.start(`Removing ${wt.dirname}...`)
              try {
                await removeWorktree(wt.path)
                try {
                  await deleteBranch(wt.branch, true)
                  removeSpinner.succeed(`Removed: ${wt.dirname} (branch deleted)`)
                } catch {
                  removeSpinner.succeed(`Removed: ${wt.dirname}` + chalk.yellow(` (branch kept)`))
                }
                removed++
              } catch (error) {
                removeSpinner.fail(`Failed to remove: ${wt.dirname}`)
                if (error instanceof Error) {
                  console.log(chalk.red(`  ${error.message}`))
                }
                failed++
              }
            } else if (item.type === 'abandoned') {
              const folder = item.data
              removeSpinner.start(`Removing ${folder.dirname}...`)
              try {
                await execa('rm', ['-rf', folder.path])
                removeSpinner.succeed(`Removed: ${folder.dirname}`)
                abandonedRemoved++
              } catch (error) {
                removeSpinner.fail(`Failed to remove: ${folder.dirname}`)
                if (error instanceof Error) {
                  console.log(chalk.red(`  ${error.message}`))
                }
                abandonedFailed++
              }
            } else {
              const orphan = item.data
              removeSpinner.start(`Removing ${orphan.dirname}...`)
              try {
                await execa('rm', ['-rf', orphan.path])
                removeSpinner.succeed(`Removed: ${orphan.dirname}`)
                orphanRemoved++
              } catch (error) {
                removeSpinner.fail(`Failed to remove: ${orphan.dirname}`)
                if (error instanceof Error) {
                  console.log(chalk.red(`  ${error.message}`))
                }
                orphanFailed++
              }
            }
          }

          // Summary
          console.log('━'.repeat(60))

          const foldersRemoved = abandonedRemoved + orphanRemoved
          const foldersFailed = abandonedFailed + orphanFailed
          const totalRemoved = removed + foldersRemoved

          if (removed > 0 && foldersRemoved > 0) {
            console.log(chalk.green(`✓ Cleaned up ${removed} worktree(s) and ${foldersRemoved} folder(s)!`))
          } else if (removed > 0) {
            console.log(chalk.green(`✓ Cleaned up ${removed} worktree(s)!`))
          } else if (foldersRemoved > 0) {
            console.log(chalk.green(`✓ Cleaned up ${foldersRemoved} folder(s)!`))
          }

          if (failed > 0 && foldersFailed > 0) {
            console.log(chalk.red(`✗ Failed to remove ${failed} worktree(s) and ${foldersFailed} folder(s)`))
          } else if (failed > 0) {
            console.log(chalk.red(`✗ Failed to remove ${failed} worktree(s)`))
          } else if (foldersFailed > 0) {
            console.log(chalk.red(`✗ Failed to remove ${foldersFailed} folder(s)`))
          }

          if (totalRemoved > 0) {
            console.log("Run 'wt list' to see remaining worktrees.")
          }
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
