/**
 * Git utilities
 *
 * Helper functions for executing Git commands using execa.
 */

import { execa } from 'execa'
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
}

/**
 * Get repository name from git root
 */
export async function getRepoName(): Promise<string> {
  const { stdout } = await execa('git', ['rev-parse', '--show-toplevel'])
  return basename(stdout)
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
  // TODO: Implement worktree listing
  // 1. Run `git worktree list --porcelain`
  // 2. Parse output into Worktree objects
  // 3. Return array of worktrees

  throw new Error('TODO: Implementation pending');
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
export async function removeWorktree(_path: string, _force?: boolean): Promise<void> {
  // TODO: Implement worktree removal
  // 1. Run `git worktree remove` with path
  // 2. Use --force flag if specified
  // 3. Handle errors (uncommitted changes, locked, etc.)

  throw new Error('TODO: Implementation pending')
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
export async function getRemoteUrl(_remote = 'origin'): Promise<string> {
  // TODO: Implement remote URL retrieval
  // 1. Run `git remote get-url <remote>`
  // 2. Return the URL string
  // 3. Handle case where remote doesn't exist

  throw new Error('TODO: Implementation pending')
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
