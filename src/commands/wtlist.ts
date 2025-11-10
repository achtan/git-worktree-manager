#!/usr/bin/env node

/**
 * wtlist - List all worktrees with status
 *
 * Usage: wtlist [options]
 *
 * Displays all Git worktrees with their status information.
 */

import { Command } from 'commander'
import chalk from 'chalk'
import { basename, dirname, join } from 'node:path'
import {
  listWorktrees,
  getRepoName,
  getDefaultBranch,
  getCreationTime,
  hasUncommittedChanges,
  getAheadBehind,
  isPathInWorktree,
  getRemoteUrl,
} from '../utils/git.js'
import { getPRStatus, parseGitHubRepo, isGhCliAvailable } from '../utils/github.js'

const program = new Command()

interface WorktreeInfo {
  path: string
  dirname: string
  branch: string
  creationTime: number
  isCurrentWorktree: boolean
  hasUncommittedChanges: boolean
  ahead: number
  behind: number
  prStatus:
    | {
        state: 'open' | 'closed' | 'merged' | 'draft' | 'no-pr'
        url?: string
        checksStatus?: 'success' | 'failure' | 'pending' | 'none'
      }
    | undefined
}

program
  .name('wtlist')
  .description('List all worktrees with status')
  .option('--json', 'Output in JSON format')
  .action(async (options: { json?: boolean }) => {
    try {
      // Get repo info
      const repoName = await getRepoName()
      const worktrees = await listWorktrees()

      if (worktrees.length === 0) {
        console.log(chalk.yellow('No worktrees found'))
        return
      }

      // Get main worktree and construct worktrees dir
      const mainWorktree = worktrees[0]
      const worktreesDir = join(dirname(mainWorktree.path), `${repoName}-worktrees`)

      // Filter to only worktrees in the worktrees directory
      const filteredWorktrees = worktrees.filter((wt) => wt.path.includes(worktreesDir))

      if (filteredWorktrees.length === 0) {
        console.log(chalk.yellow(`No worktrees found in ${worktreesDir}`))
        return
      }

      // Get GitHub repo info
      let githubInfo: { owner: string; repo: string } | null = null
      let githubError: 'no-remote' | 'not-github' | 'gh-unavailable' | null = null

      try {
        const remoteUrl = await getRemoteUrl()
        githubInfo = parseGitHubRepo(remoteUrl)

        if (!githubInfo) {
          githubError = 'not-github'
        }
      } catch {
        githubError = 'no-remote'
      }

      // Check gh CLI availability if we have GitHub repo
      if (githubInfo) {
        const ghStatus = await isGhCliAvailable()
        if (!ghStatus.available || !ghStatus.authenticated) {
          githubError = 'gh-unavailable'
        }
      }

      // Get current path and default branch
      const currentPath = process.cwd()
      const defaultBranch = await getDefaultBranch()

      // Gather info for each worktree
      const worktreeInfos: WorktreeInfo[] = await Promise.all(
        filteredWorktrees.map(async (wt) => {
          const creationTime = await getCreationTime(wt.path)
          const uncommitted = await hasUncommittedChanges(wt.path)
          const isInWorktree = isPathInWorktree(currentPath, wt.path)

          let ahead = 0
          let behind = 0
          if (wt.branch) {
            const aheadBehind = await getAheadBehind(wt.branch, defaultBranch)
            ahead = aheadBehind.ahead
            behind = aheadBehind.behind
          }

          // Get PR status if GitHub info available and gh CLI is working
          let prStatus:
            | {
                state: 'open' | 'closed' | 'merged' | 'draft' | 'no-pr'
                url?: string
                checksStatus?: 'success' | 'failure' | 'pending' | 'none'
              }
            | undefined

          if (githubInfo && wt.branch && !githubError) {
            try {
              const pr = await getPRStatus(githubInfo.owner, githubInfo.repo, wt.branch)
              if (pr) {
                let state: 'open' | 'closed' | 'merged' | 'draft'
                if (pr.isDraft) {
                  state = 'draft'
                } else {
                  state = pr.state
                }
                prStatus = {
                  state,
                  url: pr.url,
                  checksStatus: pr.checksStatus,
                }
              } else {
                prStatus = { state: 'no-pr' }
              }
            } catch {
              prStatus = { state: 'no-pr' }
            }
          } else {
            prStatus = { state: 'no-pr' }
          }

          return {
            path: wt.path,
            dirname: basename(wt.path),
            branch: wt.branch || 'no-branch',
            creationTime,
            isCurrentWorktree: isInWorktree,
            hasUncommittedChanges: uncommitted,
            ahead,
            behind,
            prStatus,
          }
        }),
      )

      // Sort by creation time
      worktreeInfos.sort((a, b) => a.creationTime - b.creationTime)

      // Output format
      if (options.json) {
        console.log(JSON.stringify(worktreeInfos, null, 2))
        return
      }

      // Display header
      console.log(chalk.bold(`Worktrees for ${repoName}:`))
      console.log('━'.repeat(60))
      console.log()

      // Display each worktree
      for (const info of worktreeInfos) {
        // Determine color based on PR status
        let statusColor = chalk.gray
        if (info.prStatus?.state === 'open') {
          statusColor = chalk.green
        } else if (info.prStatus?.state === 'merged' || info.prStatus?.state === 'closed') {
          statusColor = chalk.magenta
        }

        // Build status line
        let statusLine = `${statusColor(info.dirname.padEnd(40))} ${statusColor(info.prStatus?.state || 'no-pr')}`

        // Add ahead/behind
        if (info.branch !== 'no-branch') {
          statusLine += ` ${chalk.gray(`(↑${info.ahead} ↓${info.behind})`)}`
        }

        // Add uncommitted changes indicator
        if (info.hasUncommittedChanges) {
          statusLine += ` ${chalk.yellow('(uncommitted changes)')}`
        }

        // Add outdated warning
        if (info.behind > 10) {
          statusLine += ` ${chalk.yellow('⚠️  outdated')}`
        }

        // Add checks status
        if (info.prStatus?.checksStatus === 'failure') {
          statusLine += ` ${chalk.red('❌ checks failing')}`
        }

        // Add current indicator
        if (info.isCurrentWorktree) {
          statusLine += ` ${chalk.cyan('← you are here')}`
        }

        console.log(statusLine)
        console.log(`  ${chalk.gray('Branch:')} ${info.branch}`)

        if (info.prStatus?.url) {
          console.log(`  ${chalk.gray('PR:')} ${info.prStatus.url}`)
        }

        console.log()
      }

      // Summary statistics
      console.log('━'.repeat(60))

      const counts = {
        total: worktreeInfos.length,
        open: worktreeInfos.filter((w) => w.prStatus?.state === 'open').length,
        draft: worktreeInfos.filter((w) => w.prStatus?.state === 'draft').length,
        merged: worktreeInfos.filter((w) => w.prStatus?.state === 'merged').length,
        closed: worktreeInfos.filter((w) => w.prStatus?.state === 'closed').length,
        noPr: worktreeInfos.filter((w) => w.prStatus?.state === 'no-pr').length,
      }

      const parts: string[] = []
      if (counts.open > 0) parts.push(`${counts.open} open`)
      if (counts.draft > 0) parts.push(`${counts.draft} draft`)
      if (counts.merged > 0) parts.push(`${counts.merged} merged`)
      if (counts.closed > 0) parts.push(`${counts.closed} closed`)
      if (counts.noPr > 0) parts.push(`${counts.noPr} no-pr`)

      let summary = `Summary: ${counts.total} worktrees`
      if (parts.length > 0) {
        summary += ` (${parts.join(', ')})`
      }

      console.log(summary)

      // Suggestions
      const cleanable = counts.merged + counts.closed
      if (cleanable > 0) {
        console.log(chalk.blue(`💡 Run 'wtclean' to remove ${cleanable} merged/closed worktree(s)`))
      }

      // Show specific message based on what failed
      if (githubError) {
        if (githubError === 'not-github') {
          console.log(chalk.blue('💡 Not a GitHub repository - PR status unavailable'))
        } else if (githubError === 'gh-unavailable') {
          const ghStatus = await isGhCliAvailable()
          if (!ghStatus.available) {
            console.log(chalk.blue('💡 Install gh CLI for PR status: brew install gh'))
          } else if (!ghStatus.authenticated) {
            console.log(chalk.blue('💡 Authenticate gh CLI for PR status: gh auth login'))
          }
        }
        // No message for 'no-remote' - it's not relevant
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`))
      } else {
        console.error(chalk.red('An unknown error occurred'))
      }
      process.exit(1)
    }
  })

program.parse()
