/**
 * clean - Remove merged/closed worktrees
 */

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { basename, dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { readdirSync, statSync, existsSync, rmSync } from 'node:fs'
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
 * Prompt user for yes/no confirmation
 */
async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
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

          // Find abandoned folders
          spinner.text = 'Scanning for abandoned folders...'
          const abandonedFolders = findAbandonedFolders(worktreesDir)

          // Stop spinner before displaying results
          spinner.stop()

          if (cleanable.length === 0 && abandonedFolders.length === 0) {
            console.log(chalk.green('✓ No merged/closed worktrees or abandoned folders found'))
            return
          }

          // Show what will be removed
          if (toRemove.length > 0) {
            console.log(chalk.bold('Cleanable worktrees:'))
            console.log()

            for (const wt of toRemove) {
              const stateColor = wt.prState === 'merged' ? chalk.magenta : chalk.magenta
              console.log(`${stateColor(wt.dirname)} (${wt.prState.toUpperCase()})`)
              console.log(`  Branch: ${wt.branch}`)
              console.log()
            }
          }

          // Show skipped worktrees
          if (skipped.length > 0) {
            console.log(chalk.yellow('⚠ Skipped (uncommitted changes):'))
            console.log()
            for (const wt of skipped) {
              console.log(`${chalk.yellow(wt.dirname)} (${wt.prState.toUpperCase()})`)
              console.log(`  Branch: ${wt.branch}`)
              console.log()
            }
          }

          // Show abandoned folders
          if (abandonedFolders.length > 0) {
            console.log(chalk.bold('Abandoned folders (no .git):'))
            console.log()
            for (const folder of abandonedFolders) {
              console.log(chalk.cyan(folder.dirname))
              console.log(chalk.gray(`  Contents: ${folder.fileCount} files, ${folder.folderCount} folders`))
              console.log()
            }
          }

          if (toRemove.length === 0 && abandonedFolders.length === 0) {
            console.log(chalk.yellow('No worktrees can be removed (all have uncommitted changes)'))
            return
          }

          // Dry run mode
          if (options.dryRun) {
            console.log('━'.repeat(60))
            if (toRemove.length > 0 && abandonedFolders.length > 0) {
              console.log(chalk.blue(`[DRY RUN] Would remove ${toRemove.length} worktree(s) and ${abandonedFolders.length} abandoned folder(s)`))
            } else if (toRemove.length > 0) {
              console.log(chalk.blue(`[DRY RUN] Would remove ${toRemove.length} worktree(s)`))
            } else {
              console.log(chalk.blue(`[DRY RUN] Would remove ${abandonedFolders.length} abandoned folder(s)`))
            }
            return
          }

          // Confirm with user
          if (!options.force) {
            console.log('━'.repeat(60))
            let confirmMessage = ''
            if (toRemove.length > 0 && abandonedFolders.length > 0) {
              confirmMessage = `Remove ${toRemove.length} worktree(s) and ${abandonedFolders.length} abandoned folder(s)?`
            } else if (toRemove.length > 0) {
              confirmMessage = `Remove ${toRemove.length} worktree(s)?`
            } else {
              confirmMessage = `Remove ${abandonedFolders.length} abandoned folder(s)?`
            }
            const confirmed = await confirm(chalk.bold(confirmMessage))
            if (!confirmed) {
              console.log(chalk.yellow('Cancelled'))
              return
            }
            console.log()
          }

          // Remove worktrees
          let removed = 0
          let failed = 0
          let abandonedRemoved = 0
          let abandonedFailed = 0

          for (const wt of toRemove) {
            try {
              // Remove worktree
              await removeWorktree(wt.path)
              console.log(chalk.green(`✓ Removed worktree: ${wt.dirname}`))

              // Ask about deleting branch
              const deleteBranchConfirmed = await confirm(
                chalk.gray(`  Delete branch '${wt.branch}'?`),
              )
              if (deleteBranchConfirmed) {
                try {
                  await deleteBranch(wt.branch, true)
                  console.log(chalk.green(`  ✓ Deleted branch: ${wt.branch}`))
                } catch (error) {
                  console.log(
                    chalk.yellow(`  ⚠ Could not delete branch: ${wt.branch}`),
                  )
                }
              } else {
                console.log(chalk.gray(`  Branch '${wt.branch}' kept`))
              }

              console.log()
              removed++
            } catch (error) {
              console.log(chalk.red(`✗ Failed to remove: ${wt.dirname}`))
              if (error instanceof Error) {
                console.log(chalk.red(`  ${error.message}`))
              }
              console.log()
              failed++
            }
          }

          // Remove abandoned folders
          for (const folder of abandonedFolders) {
            try {
              rmSync(folder.path, { recursive: true, force: true })
              console.log(chalk.green(`✓ Removed abandoned folder: ${folder.dirname}`))
              console.log()
              abandonedRemoved++
            } catch (error) {
              console.log(chalk.red(`✗ Failed to remove: ${folder.dirname}`))
              if (error instanceof Error) {
                console.log(chalk.red(`  ${error.message}`))
              }
              console.log()
              abandonedFailed++
            }
          }

          // Summary
          console.log('━'.repeat(60))

          const totalRemoved = removed + abandonedRemoved

          if (removed > 0 && abandonedRemoved > 0) {
            console.log(chalk.green(`✓ Cleaned up ${removed} worktree(s) and ${abandonedRemoved} abandoned folder(s)!`))
          } else if (removed > 0) {
            console.log(chalk.green(`✓ Cleaned up ${removed} worktree(s)!`))
          } else if (abandonedRemoved > 0) {
            console.log(chalk.green(`✓ Cleaned up ${abandonedRemoved} abandoned folder(s)!`))
          }

          if (failed > 0 && abandonedFailed > 0) {
            console.log(chalk.red(`✗ Failed to remove ${failed} worktree(s) and ${abandonedFailed} abandoned folder(s)`))
          } else if (failed > 0) {
            console.log(chalk.red(`✗ Failed to remove ${failed} worktree(s)`))
          } else if (abandonedFailed > 0) {
            console.log(chalk.red(`✗ Failed to remove ${abandonedFailed} abandoned folder(s)`))
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
