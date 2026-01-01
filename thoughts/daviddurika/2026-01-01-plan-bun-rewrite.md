# Bun Rewrite Implementation Plan

## Overview

Rewrite wt-manager CLI from Node.js to Bun runtime with compiled standalone binaries.

## Current State

**Dependencies to remove:**
- `globby` → `Bun.Glob`
- `ora` → custom spinner utility using `@clack/prompts`
- `chalk` → `picocolors`
- `@inquirer/prompts` → `@clack/prompts`

**Dependencies to keep:**
- `commander` (CLI framework)
- `execa` (shell commands)
- `octokit` (GitHub API)
- `zod` (validation)

**Files requiring changes:**

| File | Changes |
|------|---------|
| `src/cli.ts` | Replace `createRequire` with Bun-native JSON import |
| `src/commands/clean.ts` | Replace chalk, ora, @inquirer/prompts |
| `src/commands/list.ts` | Replace chalk, ora |
| `src/commands/new.ts` | Replace chalk, ora |
| `src/commands/remove.ts` | Replace chalk, ora, @inquirer/prompts |
| `src/commands/config.ts` | Replace chalk |
| `src/utils/config.ts` | Replace globby with Bun.Glob |
| `package.json` | Update deps, scripts, engines |
| `tsconfig.json` | Adjust for Bun compatibility |

**New files:**
- `src/utils/spinner.ts` - Spinner utility using @clack/prompts
- `.github/workflows/release.yml` - Binary build workflow

## Desired End State

- CLI runs natively on Bun runtime
- npm package works with `bun install -g wt-manager`
- Standalone binaries available on GitHub Releases for:
  - macOS ARM64 (M1/M2)
  - macOS x64 (Intel)
  - Linux x64
  - Linux ARM64
  - Windows x64

## What We're NOT Doing

- Dropping npm distribution (keeping both npm + binaries)
- Changing CLI command structure or behavior
- Adding new features
- Supporting Node.js runtime (Bun-only going forward)

---

## Phase 1: Update Dependencies

### Overview
Install new dependencies, remove old ones, update package.json.

### Changes Required:

#### 1.1 package.json

**File**: `package.json`
**Changes**: Update dependencies, engines, scripts

```json
{
  "engines": {
    "bun": ">=1.0.0"
  },
  "scripts": {
    "build": "bun build ./src/cli.ts --outdir=dist --target=bun",
    "build:binaries": "bun run scripts/build-binaries.ts",
    "dev": "bun --watch src/cli.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@clack/prompts": "^0.7.0",
    "commander": "^12.1.0",
    "execa": "^9.5.2",
    "octokit": "^4.0.2",
    "picocolors": "^1.1.1",
    "zod": "^4.3.4"
  }
}
```

Remove: `globby`, `ora`, `chalk`, `@inquirer/prompts`

### Success Criteria:

#### Automated Verification:
- [x] `bun install` completes without errors
- [x] No references to removed packages in source files (will be checked after all phases)

---

## Phase 2: Create Spinner Utility

### Overview
Create a spinner utility that wraps @clack/prompts spinner for ora-like API.

### Changes Required:

#### 2.1 Spinner Utility

**File**: `src/utils/spinner.ts`
**Changes**: New file

```typescript
import { spinner as clackSpinner } from '@clack/prompts'

export interface Spinner {
  start(message?: string): void
  stop(): void
  succeed(message: string): void
  fail(message: string): void
  text: string
}

export function createSpinner(): Spinner {
  let currentSpinner: ReturnType<typeof clackSpinner> | null = null
  let currentMessage = ''

  return {
    start(message = '') {
      currentMessage = message
      currentSpinner = clackSpinner()
      currentSpinner.start(message)
    },
    stop() {
      currentSpinner?.stop()
      currentSpinner = null
    },
    succeed(message: string) {
      currentSpinner?.stop(message)
      currentSpinner = null
    },
    fail(message: string) {
      currentSpinner?.stop(message)
      currentSpinner = null
    },
    get text() {
      return currentMessage
    },
    set text(value: string) {
      currentMessage = value
      currentSpinner?.message(value)
    },
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] `bun run typecheck` passes (will verify after all code migrations)

---

## Phase 3: Replace chalk with picocolors

### Overview
Replace all chalk imports with picocolors. API is nearly identical.

### Changes Required:

#### 3.1 All Command Files

**Files**: `clean.ts`, `list.ts`, `new.ts`, `remove.ts`, `config.ts`
**Changes**:

Replace:
```typescript
import chalk from 'chalk'
```

With:
```typescript
import pc from 'picocolors'
```

Replace usages:
- `chalk.red(...)` → `pc.red(...)`
- `chalk.green(...)` → `pc.green(...)`
- `chalk.yellow(...)` → `pc.yellow(...)`
- `chalk.blue(...)` → `pc.blue(...)`
- `chalk.cyan(...)` → `pc.cyan(...)`
- `chalk.gray(...)` → `pc.gray(...)`
- `chalk.magenta(...)` → `pc.magenta(...)`
- `chalk.bold(...)` → `pc.bold(...)`
- `chalk.hex('#FFA500')(...)` → `pc.yellow(...)` (closest approximation for orange)

### Success Criteria:

#### Automated Verification:
- [x] `bun run typecheck` passes (will verify after all code migrations)
- [x] No imports of `chalk` remain

---

## Phase 4: Replace ora with Spinner Utility

### Overview
Replace ora imports with custom spinner utility.

### Changes Required:

#### 4.1 Command Files

**Files**: `clean.ts`, `list.ts`, `new.ts`, `remove.ts`
**Changes**:

Replace:
```typescript
import ora from 'ora'
const spinner = ora()
```

With:
```typescript
import { createSpinner } from '../utils/spinner.js'
const spinner = createSpinner()
```

### Success Criteria:

#### Automated Verification:
- [x] `bun run typecheck` passes
- [x] No imports of `ora` remain

---

## Phase 5: Replace @inquirer/prompts with @clack/prompts

### Overview
Replace checkbox and select prompts.

### Changes Required:

#### 5.1 clean.ts

**File**: `src/commands/clean.ts`
**Changes**:

Replace:
```typescript
import { checkbox } from '@inquirer/prompts'

selectedItems = await checkbox({
  message: 'Select worktrees to remove:',
  choices,
})
```

With:
```typescript
import { multiselect } from '@clack/prompts'

const result = await multiselect({
  message: 'Select worktrees to remove:',
  options: choices.map(c => ({
    label: c.name,
    value: c.value,
  })),
})

if (typeof result === 'symbol') {
  // User cancelled
  return
}
selectedItems = result
```

#### 5.2 remove.ts

**File**: `src/commands/remove.ts`
**Changes**:

Replace:
```typescript
import { select } from '@inquirer/prompts'

const action = await select({
  message: 'What would you like to do?',
  choices,
})
```

With:
```typescript
import { select } from '@clack/prompts'

const action = await select({
  message: 'What would you like to do?',
  options: choices.map(c => ({
    label: c.name,
    value: c.value,
  })),
})

if (typeof action === 'symbol') {
  console.log(pc.yellow('Aborted.'))
  return
}
```

### Success Criteria:

#### Automated Verification:
- [x] `bun run typecheck` passes
- [x] No imports of `@inquirer/prompts` remain

---

## Phase 6: Replace globby with Bun.Glob

### Overview
Replace globby with Bun's native Glob API.

### Changes Required:

#### 6.1 config.ts

**File**: `src/utils/config.ts`
**Changes**:

Replace:
```typescript
import { globby } from 'globby'

const filesToCopy = await globby(copyPatterns, {
  cwd: mainWorktreePath,
  dot: true,
  onlyFiles: true,
})
```

With:
```typescript
/**
 * Expand glob patterns with negation support
 * Patterns starting with ! are negations
 */
async function expandGlobs(patterns: string[], cwd: string): Promise<string[]> {
  const positive = patterns.filter(p => !p.startsWith('!'))
  const negative = patterns.filter(p => p.startsWith('!')).map(p => p.slice(1))

  const results: string[] = []
  for (const pattern of positive) {
    const glob = new Bun.Glob(pattern)
    for await (const file of glob.scan({ cwd, dot: true })) {
      results.push(file)
    }
  }

  // Dedupe
  const unique = [...new Set(results)]

  // Filter out negated patterns
  if (negative.length === 0) return unique

  const negativeGlobs = negative.map(p => new Bun.Glob(p))
  return unique.filter(file =>
    !negativeGlobs.some(glob => glob.match(file))
  )
}

const filesToCopy = await expandGlobs(copyPatterns, mainWorktreePath)
```

### Success Criteria:

#### Automated Verification:
- [x] `bun run typecheck` passes
- [x] No imports of `globby` remain

---

## Phase 7: Update CLI Entry Point

### Overview
Update cli.ts for Bun-native imports and shebang.

### Changes Required:

#### 7.1 cli.ts

**File**: `src/cli.ts`
**Changes**:

Replace:
```typescript
#!/usr/bin/env node
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }
```

With:
```typescript
#!/usr/bin/env bun
import pkg from '../package.json'
```

Update tsconfig.json to allow JSON imports:
```json
{
  "compilerOptions": {
    "resolveJsonModule": true
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] `bun run typecheck` passes
- [ ] `./src/cli.ts --version` outputs version

---

## Phase 8: Add Build Scripts

### Overview
Add scripts for building binaries.

### Changes Required:

#### 8.1 Build Binary Script

**File**: `scripts/build-binaries.ts`
**Changes**: New file

```typescript
import { $ } from 'bun'

const targets = [
  { name: 'wt-darwin-arm64', target: 'bun-darwin-arm64' },
  { name: 'wt-darwin-x64', target: 'bun-darwin-x64' },
  { name: 'wt-linux-x64', target: 'bun-linux-x64' },
  { name: 'wt-linux-arm64', target: 'bun-linux-arm64' },
  { name: 'wt-windows-x64.exe', target: 'bun-windows-x64' },
]

await $`mkdir -p dist/binaries`

for (const { name, target } of targets) {
  console.log(`Building ${name}...`)
  await $`bun build ./src/cli.ts --compile --target=${target} --outfile=dist/binaries/${name}`
}

console.log('Done!')
```

### Success Criteria:

#### Automated Verification:
- [ ] `bun run scripts/build-binaries.ts` completes
- [ ] Binaries exist in `dist/binaries/`

---

## Phase 9: Switch to Biome

### Overview
Replace ESLint + Prettier with Biome.

### Changes Required:

#### 9.1 Install Biome

```bash
bun add -d @biomejs/biome
bun x biome init
```

#### 9.2 Update package.json scripts

```json
{
  "scripts": {
    "lint": "biome check src",
    "lint:fix": "biome check --write src",
    "format": "biome format --write src",
    "format:check": "biome format src"
  }
}
```

#### 9.3 Remove old dependencies

Remove: `eslint`, `@typescript-eslint/*`, `prettier`

Delete: `.eslintrc*`, `.prettierrc*` (if they exist)

### Success Criteria:

#### Automated Verification:
- [ ] `bun run lint` passes
- [ ] `bun run format:check` passes

---

## Phase 10: GitHub Actions Release Workflow

### Overview
Add workflow for building and releasing binaries.

### Changes Required:

#### 9.1 Release Workflow

**File**: `.github/workflows/release.yml`
**Changes**: New file

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - run: bun install

      - run: bun run scripts/build-binaries.ts

      - uses: softprops/action-gh-release@v2
        with:
          files: dist/binaries/*
```

### Success Criteria:

#### Manual Verification:
- [ ] Push a tag, verify workflow runs
- [ ] Binaries appear on GitHub Release page

---

## Testing Strategy

### Manual Testing Steps:

1. Build and run locally:
   ```bash
   bun install
   bun src/cli.ts --version
   bun src/cli.ts list
   bun src/cli.ts new test-branch
   bun src/cli.ts clean --dry-run
   bun src/cli.ts remove test-branch
   ```

2. Test binary:
   ```bash
   bun run scripts/build-binaries.ts
   ./dist/binaries/wt-darwin-arm64 --version
   ./dist/binaries/wt-darwin-arm64 list
   ```

3. Test npm package locally:
   ```bash
   bun link
   wt --version
   ```

---

## Decisions

- **Type checking**: `tsc --noEmit`
- **Glob negation**: Manual filtering with `Bun.Glob.match()`
- **Linting/Formatting**: Biome (replaces ESLint + Prettier)
