---
date: 2026-01-01
author: daviddurika
branch: feat/to-bun
repository: git-worktree-manager
topic: "Add Unit Tests - Easy Wins"
tags: [plan, testing, unit-tests, bun]
---

# Add Unit Tests - Easy Wins

## Overview

Add unit testing infrastructure using Bun's built-in test runner and create tests for pure functions that require no mocking.

## Current State

- No testing framework configured
- No test scripts in package.json
- Project uses Bun runtime (has built-in test runner)
- Several pure functions exist that are ideal for unit testing

## Desired End State

- `bun test` runs unit tests
- Pure utility functions have comprehensive test coverage
- Test patterns established for future development

## What We're NOT Doing

- Testing command files (heavy I/O and side effects)
- E2E testing
- Exhaustive edge case coverage

## Implementation Approach

Use Bun's built-in test runner - zero dependencies needed. Start with pure functions that have no external dependencies.

## Phase 1: Setup Testing Infrastructure

### Overview
Add test script and create first test file to verify setup works.

### Changes Required:

#### 1.1 Add test script

**File**: `package.json`
**Changes**: Add test script

```json
"scripts": {
  "test": "bun test",
  ...
}
```

#### 1.2 Create test directory structure

```
src/
  utils/
    __tests__/
      github.test.ts
      config.test.ts
      git.test.ts
```

### Success Criteria:

#### Automated Verification:
- [x] `bun test` runs without errors
- [x] `bun run typecheck` passes

---

## Phase 2: Test parseGitHubRepo

### Overview
Test the pure URL parsing function - highest value, easiest to test.

**File**: `src/utils/__tests__/github.test.ts`

### Test Cases:
- SSH format with/without .git suffix
- HTTPS format with/without .git suffix
- Invalid URL returns null

### Success Criteria:

#### Automated Verification:
- [x] `bun test src/utils/__tests__/github.test.ts` passes
- [x] `bun run typecheck` passes

---

## Phase 3: Test config utility functions

### Overview
Test pure config functions: `resolveTemplate`, `resolveConfig`, `getDefaults`.

**File**: `src/utils/__tests__/config.test.ts`

### Test Cases:
- resolveTemplate: replaces variables, handles multiple
- resolveConfig: transforms full config object
- getDefaults: returns expected structure

### Success Criteria:

#### Automated Verification:
- [x] `bun test src/utils/__tests__/config.test.ts` passes
- [x] `bun run typecheck` passes

---

## Phase 4: Test isPathInWorktree

### Overview
Simple path comparison utility.

**File**: `src/utils/__tests__/git.test.ts`

### Test Cases:
- Matching and non-matching paths

### Success Criteria:

#### Automated Verification:
- [x] `bun test src/utils/__tests__/git.test.ts` passes
- [x] `bun run typecheck` passes

---

## Phase 5: Test listWorktrees

### Overview
Test git worktree list porcelain parsing. Mock execa.

**File**: `src/utils/__tests__/git.test.ts`

### Test Cases:
- Parse single worktree output
- Parse multiple worktrees
- First worktree marked as main

### Success Criteria:

#### Automated Verification:
- [x] `bun test src/utils/__tests__/git.test.ts` passes

---

## Phase 6: Test loadConfig

### Overview
Test config loading with temp files.

**File**: `src/utils/__tests__/config.test.ts`

### Test Cases:
- Valid config file returns config
- Missing file returns defaults
- Invalid JSON throws ConfigValidationError

### Success Criteria:

#### Automated Verification:
- [x] `bun test src/utils/__tests__/config.test.ts` passes

---

## Phase 7: Test copyConfigFiles

### Overview
Test file copy/symlink operations with temp directories.

**File**: `src/utils/__tests__/config.test.ts`

### Test Cases:
- Copy files from source to target
- Create symlinks
- Handle missing source files gracefully

### Success Criteria:

#### Automated Verification:
- [x] `bun test src/utils/__tests__/config.test.ts` passes

---

## Functions Covered

| Function | File | Complexity |
|----------|------|------------|
| parseGitHubRepo | github.ts:157-171 | Easy |
| resolveTemplate | config.ts:177-183 | Easy |
| resolveConfig | config.ts:190-197 | Easy |
| getDefaults | config.ts:73-80 | Easy |
| isPathInWorktree | git.ts:248-250 | Easy |
| listWorktrees | git.ts:65-102 | Medium (mock execa) |
| loadConfig | config.ts:87-136 | Medium (temp files) |
| copyConfigFiles | config.ts:214-269 | Medium (temp dirs) |

## References

- Bun test documentation: https://bun.sh/docs/cli/test
