/**
 * Git utilities
 *
 * Helper functions for executing Git commands using execa.
 */

import { execa } from 'execa'
import { mkdir, stat } from 'node:fs/promises'
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
 * Get repository name from main worktree
 * Works correctly even when called from within a worktree
 */
export async function getRepoName(): Promise<string> {
  // Get all worktrees - first one is always the main worktree
  const { stdout } = await execa('git', ['worktree', 'list'])
  const firstLine = stdout.split('\n')[0]
  const mainWorktreePath = firstLine.split(/\s+/)[0]
  return basename(mainWorktreePath)
}

/**
 * Get default branch from origin/HEAD
 * Falls back to 'develop' if origin/HEAD is not set
 */
export async function getDefaultBranch(): Promise<string> {
  try {
    const { stdout } = await execa('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'])
    return stdout.replace('refs/remotes/origin/', '')
  } catch {
    return 'develop'
  }
}

/**
 * Get list of all worktrees
 */
export async function listWorktrees(): Promise<Worktree[]> {
  const { stdout } = await execa('git', ['worktree', 'list', '--porcelain'])
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
  await execa('git', ['worktree', 'add', '-b', branchName, worktreePath, baseBranch])
}

/**
 * Remove a worktree
 */
export async function removeWorktree(path: string, force?: boolean): Promise<void> {
  const args = ['worktree', 'remove', path]
  if (force) {
    args.push('--force')
  }
  await execa('git', args)
}

/**
 * Delete a local branch
 */
export async function deleteBranch(branch: string, force?: boolean): Promise<void> {
  const flag = force ? '-D' : '-d'
  await execa('git', ['branch', flag, branch])
}

/**
 * Check if a branch exists locally
 */
export async function branchExists(branch: string): Promise<boolean> {
  const { stdout } = await execa('git', ['branch', '--list', branch])
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
  const { stdout } = await execa('git', ['remote', 'get-url', remote])
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
    const stats = await stat(path)
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
    const { stdout } = await execa('git', ['-C', path, 'status', '--porcelain'])
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
    const aheadResult = await execa('git', [
      'rev-list',
      '--count',
      `${baseBranch}..${branch}`,
    ])
    const behindResult = await execa('git', [
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
  const { stdout } = await execa('git', ['rev-parse', '--show-toplevel'])
  return stdout.trim()
}

/**
 * Check if path is within worktree
 */
export function isPathInWorktree(currentPath: string, worktreePath: string): boolean {
  return currentPath.startsWith(worktreePath)
}
