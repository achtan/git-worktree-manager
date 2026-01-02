# Implementation Plan: CLI Improvements

## Overview

Add three improvements to the `wt` CLI:
1. `-p` flag for `path` command to print path without clipboard copy
2. `wt doctor` command for environment diagnostics
3. Complete TODO implementations (`getWorktreeStatus`, `isBranchMerged`)

---

## Phase 1: Add `-q, --quiet` flag to `path` command

### File: `src/commands/path.ts`

**Changes:**
1. Add `.option('-q, --quiet', 'Output path only (for scripting)')`
2. Modify action handler to accept `options: { quiet?: boolean }`
3. When `options.quiet` is true:
   - No spinner
   - No interactive select (require name argument)
   - No clipboard copy
   - Just print raw path to stdout

```typescript
cmd
  .description('Select a worktree and copy its path to clipboard')
  .argument('[name]', 'Worktree name (fuzzy match)')
  .option('-q, --quiet', 'Output path only (for scripting)')
  .action(async (name?: string, options?: { quiet?: boolean }) => {
```

**Output behavior:**
- With `-q`: `console.log(path)` (raw path only, no other output)
- Without `-q`: Current behavior (interactive select, copy + green message)

**Usage examples:**
```bash
cd $(wt path -q feature)
code $(wt path -q main)
```

### Success Criteria
- [ ] `wt path -q feature` prints raw path only
- [ ] `wt path -q` without name shows error (requires name in quiet mode)
- [ ] `wt path` still works interactively (existing behavior)

---

## Phase 2: Add `wt doctor` command

### File: `src/commands/doctor.ts` (new)

**Checks to perform:**

| Check | Command | Pass | Fail |
|-------|---------|------|------|
| Git installed | `git --version` | Show version | Error |
| Inside git repo | `git rev-parse --git-dir` | ✓ | Not a git repo |
| `gh` CLI installed | `gh --version` | Show version | Warn: install gh |
| `gh` authenticated | `gh auth status` | ✓ | Warn: run `gh auth login` |
| Worktrees directory exists | Check `<repo>-worktrees/` | Show count | Info: no worktrees yet |
| Config file exists | Check `.wtrc.js` | Show path | Info: using defaults |

**Output format:**
```
wt doctor

Checks:
  ✓ Git: 2.43.0
  ✓ Repository: git-worktree-manager
  ✓ GitHub CLI: 2.40.0
  ✓ GitHub auth: authenticated as user
  ✓ Worktrees: 3 worktrees in ../git-worktree-manager-worktrees/
  ○ Config: using defaults (no .wtrc.js)

All checks passed!
```

### File: `src/cli.ts`

Add import and register command:
```typescript
import { doctorCommand } from './commands/doctor.js'
// ...
program.addCommand(doctorCommand())
```

### Success Criteria
- [ ] `wt doctor` runs all checks
- [ ] Shows git version
- [ ] Shows gh CLI status with actionable hints
- [ ] Works from any worktree or main repo

---

## Phase 3: Implement `isBranchMerged` (git.ts)

### File: `src/utils/git.ts:153-159`

**Current:**
```typescript
export async function isBranchMerged(_branch: string, _baseBranch = 'main'): Promise<boolean> {
  throw new Error('TODO: Implementation pending')
}
```

**Implementation:**
```typescript
export async function isBranchMerged(branch: string, baseBranch = 'main'): Promise<boolean> {
  try {
    const { stdout } = await exec('git', ['branch', '--merged', baseBranch])
    const mergedBranches = stdout
      .split('\n')
      .map(line => line.replace(/^\*?\s+/, '').trim())
      .filter(Boolean)
    return mergedBranches.includes(branch)
  } catch {
    return false
  }
}
```

### Success Criteria
- [ ] Returns `true` if branch is merged into baseBranch
- [ ] Returns `false` if not merged
- [ ] Handles errors gracefully

---

## Phase 4: Implement `isBranchMerged` (github.ts)

### File: `src/utils/github.ts:142-152`

**Implementation:**
Use existing `getPRStatus` - if PR state is `merged`, branch is merged.

```typescript
export async function isBranchMerged(
  owner: string,
  repo: string,
  branch: string,
): Promise<boolean> {
  const pr = await getPRStatus(owner, repo, branch)
  return pr?.state === 'merged'
}
```

### Success Criteria
- [ ] Returns `true` if PR for branch is merged
- [ ] Returns `false` if no PR or PR not merged
- [ ] Handles API errors gracefully

---

## Phase 5: Implement `getWorktreeStatus`

### File: `src/utils/git.ts:172-183`

**Implementation:**
```typescript
export async function getWorktreeStatus(path: string): Promise<{
  clean: boolean
  ahead: number
  behind: number
}> {
  try {
    const { stdout } = await exec('git', ['-C', path, 'status', '--porcelain', '--branch'])
    const lines = stdout.split('\n')

    // First line: ## branch...tracking [ahead N, behind M]
    const branchLine = lines[0] || ''
    let ahead = 0
    let behind = 0

    const aheadMatch = branchLine.match(/ahead (\d+)/)
    const behindMatch = branchLine.match(/behind (\d+)/)
    if (aheadMatch) ahead = parseInt(aheadMatch[1], 10)
    if (behindMatch) behind = parseInt(behindMatch[1], 10)

    // Remaining lines are file changes
    const clean = lines.slice(1).filter(l => l.trim()).length === 0

    return { clean, ahead, behind }
  } catch {
    return { clean: true, ahead: 0, behind: 0 }
  }
}
```

### Success Criteria
- [ ] Returns `clean: true` if no uncommitted changes
- [ ] Correctly parses ahead/behind counts
- [ ] Handles errors gracefully

---

## File Summary

| File | Action |
|------|--------|
| `src/commands/path.ts` | Add `-q, --quiet` option |
| `src/commands/doctor.ts` | New file |
| `src/cli.ts` | Register doctor command |
| `src/utils/git.ts` | Implement `isBranchMerged`, `getWorktreeStatus` |
| `src/utils/github.ts` | Implement `isBranchMerged` |
