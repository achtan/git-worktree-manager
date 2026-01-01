/**
 * Git utilities
 *
 * Helper functions for executing Git commands using execa.
 */

import { exec } from './exec.js'
import { mkdir } from 'node:fs/promises'
import { basename } from 'node:path'

/**
 * Worktree information
 */
export interface Worktree {
  path: string
  branch: string
  commit: string
  isMain: boolean
  creationTime?: number
  hasUncommittedChanges?: boolean
}

/**
 * Get main worktree path (first worktree is always the main one)
 * Works correctly even when called from within a worktree
 */
export async function getMainWorktreePath(): Promise<string> {
  const { stdout } = await exec('git', ['worktree', 'list'])
  const firstLine = stdout.split('\n')[0]
  return firstLine.split(/\s+/)[0]
}

/**
 * Get repository name from main worktree
 * Works correctly even when called from within a worktree
 */
export async function getRepoName(): Promise<string> {
  const mainWorktreePath = await getMainWorktreePath()
  return basename(mainWorktreePath)
}

/**
 * Get default branch from origin/HEAD
 * Falls back to 'develop' if origin/HEAD is not set
 */
export async function getDefaultBranch(): Promise<string> {
  try {
    const { stdout } = await exec('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'])
    return stdout.replace('refs/remotes/origin/', '')
  } catch {
    return 'develop'
  }
}

/**
 * Fetch from origin
 */
export async function fetchOrigin(): Promise<void> {
  await exec('git', ['fetch', 'origin'])
}

/**
 * Get list of all worktrees
 */
export async function listWorktrees(): Promise<Worktree[]> {
  const { stdout } = await exec('git', ['worktree', 'list', '--porcelain'])
  const worktrees: Worktree[] = []

  const lines = stdout.trim().split('\n')
  let current: Partial<Worktree> = {}

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      if (current.path) {
        worktrees.push(current as Worktree)
      }
      current = { path: line.substring(9), isMain: false }
    } else if (line.startsWith('HEAD ')) {
      current.commit = line.substring(5)
    } else if (line.startsWith('branch ')) {
      current.branch = line.substring(7).replace('refs/heads/', '')
    } else if (line === 'bare') {
      current.isMain = true
    } else if (line === '') {
      if (current.path) {
        worktrees.push(current as Worktree)
        current = {}
      }
    }
  }

  if (current.path) {
    worktrees.push(current as Worktree)
  }

  // Mark first worktree as main
  if (worktrees.length > 0) {
    worktrees[0].isMain = true
  }

  return worktrees
}

/**
 * Ensure directory exists (mkdir -p equivalent)
 */
export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

/**
 * Create a new worktree
 * Replicates: git worktree add -b <branch> <path> <baseBranch>
 */
export async function createWorktree(
  branchName: string,
  worktreePath: string,
  baseBranch: string,
): Promise<void> {
  await exec('git', ['worktree', 'add', '-b', branchName, worktreePath, baseBranch])
}

/**
 * Remove a worktree
 */
export async function removeWorktree(path: string, force?: boolean): Promise<void> {
  const args = ['worktree', 'remove', path]
  if (force) {
    args.push('--force')
  }
  await exec('git', args)
}

/**
 * Delete a local branch
 */
export async function deleteBranch(branch: string, force?: boolean): Promise<void> {
  const flag = force ? '-D' : '-d'
  await exec('git', ['branch', flag, branch])
}

/**
 * Check if a branch exists locally
 */
export async function branchExists(branch: string): Promise<boolean> {
  const { stdout } = await exec('git', ['branch', '--list', branch])
  return stdout.trim().length > 0
}

/**
 * Check if a branch is merged
 */
export async function isBranchMerged(_branch: string, _baseBranch = 'main'): Promise<boolean> {
  // TODO: Implement local merge status check
  // 1. Run `git branch --merged <baseBranch>`
  // 2. Check if branch appears in output

  throw new Error('TODO: Implementation pending')
}

/**
 * Get git remote URL
 */
export async function getRemoteUrl(remote = 'origin'): Promise<string> {
  const { stdout } = await exec('git', ['remote', 'get-url', remote])
  return stdout.trim()
}

/**
 * Get worktree status (dirty/clean)
 */
export async function getWorktreeStatus(_path: string): Promise<{
  clean: boolean
  ahead: number
  behind: number
}> {
  // TODO: Implement status check
  // 1. Run `git -C <path> status --porcelain --branch`
  // 2. Parse output for uncommitted changes and tracking info
  // 3. Return status object

  throw new Error('TODO: Implementation pending')
}

/**
 * Get creation time of a directory
 */
export async function getCreationTime(path: string): Promise<number> {
  try {
    const stats = await Bun.file(path).stat()
    return stats.birthtimeMs
  } catch {
    return 0
  }
}

/**
 * Check if worktree has uncommitted changes
 */
export async function hasUncommittedChanges(path: string): Promise<boolean> {
  try {
    const { stdout } = await exec('git', ['-C', path, 'status', '--porcelain'])
    return stdout.trim().length > 0
  } catch {
    return false
  }
}

/**
 * Get ahead/behind info for a branch
 */
export async function getAheadBehind(
  branch: string,
  baseBranch: string,
): Promise<{ ahead: number; behind: number }> {
  try {
    const aheadResult = await exec('git', [
      'rev-list',
      '--count',
      `${baseBranch}..${branch}`,
    ])
    const behindResult = await exec('git', [
      'rev-list',
      '--count',
      `${branch}..${baseBranch}`,
    ])

    return {
      ahead: parseInt(aheadResult.stdout, 10) || 0,
      behind: parseInt(behindResult.stdout, 10) || 0,
    }
  } catch {
    return { ahead: 0, behind: 0 }
  }
}

/**
 * Get current worktree path
 */
export async function getCurrentWorktreePath(): Promise<string> {
  const { stdout } = await exec('git', ['rev-parse', '--show-toplevel'])
  return stdout.trim()
}

/**
 * Check if path is within worktree
 */
export function isPathInWorktree(currentPath: string, worktreePath: string): boolean {
  return currentPath.startsWith(worktreePath)
}

/**
 * Get worktree changes (modified and untracked files)
 */
export async function getWorktreeChanges(
  path: string,
): Promise<{ modified: string[]; untracked: string[] }> {
  try {
    const { stdout } = await exec('git', ['-C', path, 'status', '--porcelain'])
    const lines = stdout.trim().split('\n').filter(Boolean)

    const modified: string[] = []
    const untracked: string[] = []

    for (const line of lines) {
      if (line.startsWith('??')) {
        untracked.push(line)
      } else {
        modified.push(line)
      }
    }

    return { modified, untracked }
  } catch {
    return { modified: [], untracked: [] }
  }
}

/**
 * Get git diff with color output
 */
export async function getGitDiff(path: string): Promise<string> {
  try {
    // Get staged + unstaged diff
    const { stdout: unstagedDiff } = await exec('git', ['-C', path, 'diff', '--color'])
    const { stdout: stagedDiff } = await exec('git', ['-C', path, 'diff', '--cached', '--color'])

    const parts: string[] = []
    if (stagedDiff.trim()) parts.push(stagedDiff)
    if (unstagedDiff.trim()) parts.push(unstagedDiff)

    return parts.join('\n')
  } catch {
    return ''
  }
}

/**
 * Force remove a directory
 */
export async function forceRemoveDirectory(path: string): Promise<void> {
  const { rm } = await import('node:fs/promises')
  await rm(path, { recursive: true, force: true })
}

/**
 * Prune stale worktree entries
 */
export async function pruneWorktrees(): Promise<void> {
  await exec('git', ['worktree', 'prune'])
}

/**
 * Check if branch has unpushed commits
 * Returns { hasUnpushed: boolean, noRemote: boolean }
 */
export async function hasUnpushedCommits(
  branch: string,
): Promise<{ hasUnpushed: boolean; noRemote: boolean }> {
  try {
    // Check if branch has a remote tracking branch
    const { stdout: remoteBranch } = await exec('git', [
      'rev-parse',
      '--abbrev-ref',
      `${branch}@{upstream}`,
    ])

    if (!remoteBranch.trim()) {
      return { hasUnpushed: false, noRemote: true }
    }

    // Check if there are commits not pushed to remote
    const { stdout } = await exec('git', [
      'rev-list',
      '--count',
      `${remoteBranch.trim()}..${branch}`,
    ])

    const unpushedCount = parseInt(stdout.trim(), 10)
    return { hasUnpushed: unpushedCount > 0, noRemote: false }
  } catch {
    // No upstream branch configured
    return { hasUnpushed: false, noRemote: true }
  }
}
