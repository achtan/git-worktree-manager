/**
 * path - Interactive worktree selector, copies path to clipboard
 */

import { basename, dirname, join } from 'node:path'
import { select } from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'
import { copyToClipboard } from '../utils/clipboard.js'
import {
  getAheadBehind,
  getDefaultBranch,
  getRemoteUrl,
  getRepoName,
  listWorktrees,
} from '../utils/git.js'
import { getPRStatus, isGhCliAvailable, parseGitHubRepo } from '../utils/github.js'
import { createSpinner } from '../utils/spinner.js'

interface WorktreeOption {
  path: string
  dirname: string
  branch: string
  ahead: number
  behind: number
  prState?: 'open' | 'closed' | 'merged' | 'draft' | 'no-pr'
}

export function pathCommand() {
  const cmd = new Command('path')

  cmd
    .description('Select a worktree and copy its path to clipboard')
    .argument('[name]', 'Worktree name (fuzzy match on branch or directory name)')
    .option('-q, --quiet', 'Output path only (for scripting)')
    .action(async (name: string | undefined, options: { quiet?: boolean }) => {
      const { quiet } = options

      // Quiet mode requires name argument
      if (quiet && !name) {
        console.error(pc.red('Error: name argument required in quiet mode'))
        process.exit(1)
      }

      const spinner = quiet ? null : createSpinner()
      spinner?.start('Finding worktrees...')

      try {
        const repoName = await getRepoName()
        const worktrees = await listWorktrees()

        // Get main worktree and construct worktrees dir
        const mainWorktree = worktrees[0]
        const worktreesDir = join(dirname(mainWorktree.path), `${repoName}-worktrees`)

        // Filter to only worktrees in the worktrees directory
        const filteredWorktrees = worktrees.filter((wt) => wt.path.includes(worktreesDir))

        if (filteredWorktrees.length === 0) {
          spinner?.stop()
          if (quiet) {
            process.exit(1)
          }
          console.log(pc.yellow(`No worktrees found in ${worktreesDir}`))
          return
        }

        // If name provided, try fuzzy match
        if (name) {
          const nameLower = name.toLowerCase()
          const matched = filteredWorktrees.find(
            (wt) =>
              wt.branch?.toLowerCase().includes(nameLower) ||
              basename(wt.path).toLowerCase().includes(nameLower),
          )

          if (matched) {
            spinner?.stop()
            if (quiet) {
              console.log(matched.path)
              return
            }
            const copied = await copyToClipboard(matched.path)
            if (copied) {
              console.log(pc.green(`✓ Copied to clipboard: ${matched.path}`))
            } else {
              console.log(pc.yellow(`Path: ${matched.path}`))
              console.log(pc.gray('(clipboard copy failed)'))
            }
            return
          }

          spinner?.stop()
          if (quiet) {
            console.error(pc.red(`No worktree matching '${name}' found`))
            process.exit(1)
          }
          console.log(pc.yellow(`No worktree matching '${name}' found`))
          console.log(pc.gray('Showing all worktrees...'))
          console.log()
        }

        // Get GitHub info for PR status
        let githubInfo: { owner: string; repo: string } | null = null
        let canFetchPR = false

        try {
          const remoteUrl = await getRemoteUrl()
          githubInfo = parseGitHubRepo(remoteUrl)
          if (githubInfo) {
            const ghStatus = await isGhCliAvailable()
            canFetchPR = ghStatus.available && ghStatus.authenticated
          }
        } catch {
          // Ignore - PR status is optional
        }

        const defaultBranch = await getDefaultBranch()

        if (spinner) spinner.text = 'Gathering worktree info...'

        // Build options with status info
        const options: WorktreeOption[] = await Promise.all(
          filteredWorktrees.map(async (wt) => {
            let ahead = 0
            let behind = 0
            if (wt.branch) {
              const ab = await getAheadBehind(wt.branch, defaultBranch)
              ahead = ab.ahead
              behind = ab.behind
            }

            let prState: 'open' | 'closed' | 'merged' | 'draft' | 'no-pr' = 'no-pr'
            if (githubInfo && wt.branch && canFetchPR) {
              try {
                const pr = await getPRStatus(githubInfo.owner, githubInfo.repo, wt.branch)
                if (pr) {
                  prState = pr.isDraft ? 'draft' : pr.state
                }
              } catch {
                // Ignore
              }
            }

            return {
              path: wt.path,
              dirname: basename(wt.path),
              branch: wt.branch || 'no-branch',
              ahead,
              behind,
              prState,
            }
          }),
        )

        spinner?.stop()

        // Build select options with formatted labels
        const selectOptions = options.map((opt) => {
          let label = opt.dirname.padEnd(30)

          // Add ahead/behind
          if (opt.ahead > 0 || opt.behind > 0) {
            label += ` (↑${opt.ahead} ↓${opt.behind})`
          }

          // Add PR state with color coding
          if (opt.prState && opt.prState !== 'no-pr') {
            const stateColors: Record<string, (s: string) => string> = {
              open: pc.green,
              draft: pc.yellow,
              merged: pc.magenta,
              closed: pc.gray,
            }
            const colorFn = stateColors[opt.prState] || pc.gray
            label += ` ${colorFn(`[${opt.prState}]`)}`
          }

          return {
            value: opt.path,
            label,
            hint: opt.branch,
          }
        })

        const selected = await select({
          message: 'Select worktree:',
          options: selectOptions,
        })

        if (typeof selected === 'symbol') {
          console.log(pc.yellow('Cancelled.'))
          return
        }

        const selectedPath = selected as string
        const copied = await copyToClipboard(selectedPath)
        if (copied) {
          console.log(pc.green(`✓ Copied to clipboard: ${selectedPath}`))
        } else {
          console.log(pc.yellow(`Path: ${selectedPath}`))
          console.log(pc.gray('(clipboard copy failed)'))
        }
      } catch (error) {
        spinner?.stop()
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
