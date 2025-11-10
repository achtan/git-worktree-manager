/**
 * Git utilities
 *
 * Helper functions for executing Git commands using execa.
 */

import { execa } from 'execa';

/**
 * Worktree information
 */
export interface Worktree {
  path: string;
  branch: string;
  commit: string;
  isMain: boolean;
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
 * Create a new worktree
 */
export async function createWorktree(
  branch: string,
  path?: string,
  createBranch?: boolean
): Promise<void> {
  // TODO: Implement worktree creation
  // 1. Determine target path (default or custom)
  // 2. Run `git worktree add` with appropriate flags
  // 3. Handle branch creation if needed
  // 4. Handle errors (path exists, invalid branch, etc.)

  throw new Error('TODO: Implementation pending');
}

/**
 * Remove a worktree
 */
export async function removeWorktree(path: string, force?: boolean): Promise<void> {
  // TODO: Implement worktree removal
  // 1. Run `git worktree remove` with path
  // 2. Use --force flag if specified
  // 3. Handle errors (uncommitted changes, locked, etc.)

  throw new Error('TODO: Implementation pending');
}

/**
 * Check if a branch exists locally
 */
export async function branchExists(branch: string): Promise<boolean> {
  // TODO: Implement branch existence check
  // 1. Run `git branch --list <branch>`
  // 2. Return true if output is not empty

  throw new Error('TODO: Implementation pending');
}

/**
 * Check if a branch is merged
 */
export async function isBranchMerged(branch: string, baseBranch = 'main'): Promise<boolean> {
  // TODO: Implement local merge status check
  // 1. Run `git branch --merged <baseBranch>`
  // 2. Check if branch appears in output

  throw new Error('TODO: Implementation pending');
}

/**
 * Get git remote URL
 */
export async function getRemoteUrl(remote = 'origin'): Promise<string> {
  // TODO: Implement remote URL retrieval
  // 1. Run `git remote get-url <remote>`
  // 2. Return the URL string
  // 3. Handle case where remote doesn't exist

  throw new Error('TODO: Implementation pending');
}

/**
 * Get worktree status (dirty/clean)
 */
export async function getWorktreeStatus(path: string): Promise<{
  clean: boolean;
  ahead: number;
  behind: number;
}> {
  // TODO: Implement status check
  // 1. Run `git -C <path> status --porcelain --branch`
  // 2. Parse output for uncommitted changes and tracking info
  // 3. Return status object

  throw new Error('TODO: Implementation pending');
}
