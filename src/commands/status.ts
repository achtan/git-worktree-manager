/**
 * status - Quick status of current worktree
 */

import { Command } from 'commander'
import pc from 'picocolors'
import {
  getAheadBehind,
  getCurrentWorktreePath,
  getDefaultBranch,
  getRemoteUrl,
  getWorktreeChanges,
  listWorktrees,
} from '../utils/git.js'
import { getPRStatus, isGhCliAvailable, parseGitHubRepo } from '../utils/github.js'

export function statusCommand() {
  const cmd = new Command('status')

  cmd.description('Show status of current worktree').action(async () => {
    try {
      const currentPath = await getCurrentWorktreePath()
      const worktrees = await listWorktrees()

      // Find current worktree
      const currentWorktree = worktrees.find((wt) => wt.path === currentPath)

      if (!currentWorktree) {
        console.log(pc.yellow('Not in a worktree'))
        return
      }

      const branch = currentWorktree.branch || 'detached HEAD'
      const defaultBranch = await getDefaultBranch()

      // Get ahead/behind
      let ahead = 0
      let behind = 0
      if (currentWorktree.branch) {
        const ab = await getAheadBehind(currentWorktree.branch, defaultBranch)
        ahead = ab.ahead
        behind = ab.behind
      }

      // Branch line with ahead/behind
      let branchLine = pc.bold(branch)
      if (ahead > 0 || behind > 0) {
        branchLine += pc.gray(` (↑${ahead} ↓${behind})`)
      }
      console.log(branchLine)

      // Get PR status
      let githubInfo: { owner: string; repo: string } | null = null
      try {
        const remoteUrl = await getRemoteUrl()
        githubInfo = parseGitHubRepo(remoteUrl)
      } catch {
        // No remote
      }

      if (githubInfo && currentWorktree.branch) {
        const ghStatus = await isGhCliAvailable()
        if (ghStatus.available && ghStatus.authenticated) {
          try {
            const pr = await getPRStatus(githubInfo.owner, githubInfo.repo, currentWorktree.branch)
            if (pr) {
              const state = pr.isDraft ? 'draft' : pr.state
              const stateColors: Record<string, (s: string) => string> = {
                open: pc.green,
                draft: pc.yellow,
                merged: pc.magenta,
                closed: pc.gray,
              }
              const colorFn = stateColors[state] || pc.white

              let prLine = `PR #${pr.number} ${colorFn(state)}`

              // Add checks status
              if (pr.checksStatus) {
                const checksColors: Record<string, (s: string) => string> = {
                  success: pc.green,
                  failure: pc.red,
                  pending: pc.yellow,
                }
                const checksColorFn = checksColors[pr.checksStatus] || pc.gray
                const checksLabels: Record<string, string> = {
                  success: '✓ checks passing',
                  failure: '✗ checks failing',
                  pending: '○ checks pending',
                }
                const checksLabel = checksLabels[pr.checksStatus]
                if (checksLabel) {
                  prLine += ` - ${checksColorFn(checksLabel)}`
                }
              }

              console.log(prLine)
              console.log(pc.gray(pr.url))
            } else {
              console.log(pc.gray('No PR'))
            }
          } catch {
            // Ignore PR fetch errors
          }
        }
      }

      // Get changes
      const changes = await getWorktreeChanges(currentPath)
      const totalChanges = changes.modified.length + changes.untracked.length

      if (totalChanges > 0) {
        const parts: string[] = []
        if (changes.modified.length > 0) {
          parts.push(`${changes.modified.length} modified`)
        }
        if (changes.untracked.length > 0) {
          parts.push(`${changes.untracked.length} untracked`)
        }
        console.log(pc.yellow(parts.join(', ')))
      } else {
        console.log(pc.green('Working tree clean'))
      }
    } catch (error) {
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
