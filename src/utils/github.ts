/**
 * GitHub API utilities
 *
 * Helper functions for interacting with GitHub API using Octokit.
 * Uses existing GitHub CLI authentication (gh auth status).
 */

import { Octokit } from 'octokit'
import { exec } from './exec.js'

/**
 * Check if GitHub CLI is available and authenticated
 */
export async function isGhCliAvailable(): Promise<{
  available: boolean
  authenticated: boolean
  error?: string
}> {
  try {
    // Check if gh is installed
    await exec('gh', ['--version'])
  } catch {
    return {
      available: false,
      authenticated: false,
      error: 'gh CLI not installed',
    }
  }

  try {
    // Check if authenticated
    await exec('gh', ['auth', 'status'])
    return {
      available: true,
      authenticated: true,
    }
  } catch {
    return {
      available: true,
      authenticated: false,
      error: 'gh CLI not authenticated',
    }
  }
}

/**
 * Get authenticated Octokit instance
 * Uses GitHub CLI token from gh auth token
 */
export async function getOctokit(): Promise<Octokit> {
  try {
    const { stdout } = await exec('gh', ['auth', 'token'])
    const token = stdout.trim()
    return new Octokit({ auth: token })
  } catch (_error) {
    throw new Error('GitHub CLI not authenticated. Run: gh auth login')
  }
}

/**
 * Get PR status for a branch
 */
export async function getPRStatus(
  owner: string,
  repo: string,
  branch: string,
): Promise<{
  number: number
  state: 'open' | 'closed' | 'merged'
  title: string
  url: string
  isDraft: boolean
  checksStatus?: 'success' | 'failure' | 'pending' | 'none'
} | null> {
  try {
    const octokit = await getOctokit()

    const { data: prs } = await octokit.rest.pulls.list({
      owner,
      repo,
      head: `${owner}:${branch}`,
      state: 'all',
      per_page: 1,
    })

    if (prs.length === 0) {
      return null
    }

    const pr = prs[0]

    // Check if PR is merged
    let state: 'open' | 'closed' | 'merged'
    if (pr.merged_at) {
      state = 'merged'
    } else if (pr.state === 'closed') {
      state = 'closed'
    } else {
      state = 'open'
    }

    // Get check runs status
    let checksStatus: 'success' | 'failure' | 'pending' | 'none' = 'none'
    try {
      const { data: checkRuns } = await octokit.rest.checks.listForRef({
        owner,
        repo,
        ref: pr.head.sha,
      })

      if (checkRuns.total_count > 0) {
        const conclusions = checkRuns.check_runs.map((run) => run.conclusion)
        if (conclusions.some((c) => c === 'failure')) {
          checksStatus = 'failure'
        } else if (conclusions.every((c) => c === 'success')) {
          checksStatus = 'success'
        } else {
          checksStatus = 'pending'
        }
      }
    } catch {
      // Checks might not be available
      checksStatus = 'none'
    }

    return {
      number: pr.number,
      state,
      title: pr.title,
      url: pr.html_url,
      isDraft: pr.draft || false,
      checksStatus,
    }
  } catch (_error) {
    return null
  }
}

/**
 * Check if a branch is merged via GitHub PR status
 */
export async function isBranchMerged(
  owner: string,
  repo: string,
  branch: string,
): Promise<boolean> {
  try {
    const pr = await getPRStatus(owner, repo, branch)
    return pr?.state === 'merged'
  } catch {
    return false
  }
}

/**
 * Parse GitHub repository info from git remote URL
 */
export function parseGitHubRepo(remoteUrl: string): { owner: string; repo: string } | null {
  // SSH format: git@github.com:owner/repo.git
  const sshMatch = remoteUrl.match(/git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/)
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] }
  }

  // HTTPS format: https://github.com/owner/repo.git
  const httpsMatch = remoteUrl.match(/https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/)
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] }
  }

  return null
}
