# CLI Improvements Implementation Plan

## Overview

Three changes to the `wt` CLI:
1. Remove default action (bare `wt <branch>` no longer works, must use `wt new <branch>`)
2. Add `wt init` command - creates `.wtrc.js` in current repo
3. Migrate config from `.wtrc.json` to `.wtrc.js` (no backward compat)

## What We're NOT Doing

- `wt root` command - skipped for now
- `.wtrc.json` support - migrating to `.wtrc.js` only
- Backward compatibility for `.wtrc.json`

---

## Phase 1: Remove Default Action

### Changes Required

**File**: `src/cli.ts`

Remove lines 36-41 (the default action injection):

```typescript
// DELETE THIS BLOCK:
// Default action: if first arg doesn't match a subcommand, treat it as "new <branch>"
const args = process.argv.slice(2)
if (args.length > 0 && !['new', 'list', 'clean', 'remove', 'config', '-h', '--help', '-v', '--version'].includes(args[0])) {
  // Inject 'new' subcommand
  process.argv.splice(2, 0, 'new')
}
```

Also update the doc comment at top (lines 6-7) to remove the default action description.

### Success Criteria

#### Automated Verification:
- [x] `bun run build` succeeds
- [x] `./dist/cli.js feature/test` shows help/error (not creating worktree)
- [x] `./dist/cli.js new feature/test` still works

---

## Phase 2: Migrate Config to `.wtrc.js`

### Changes Required

**File**: `src/utils/config.ts`

Replace JSON loading with JS import:

```typescript
const CONFIG_FILENAME = '.wtrc.js'

export async function loadConfig(mainWorktreePath: string): Promise<LoadConfigResult> {
  const defaults = getDefaults()
  const configPath = join(mainWorktreePath, CONFIG_FILENAME)

  try {
    const file = Bun.file(configPath)
    if (!(await file.exists())) {
      return { config: defaults, source: 'defaults' }
    }

    const module = await import(configPath)
    const config = module.default ?? module

    const result = WtConfigSchema.safeParse(config)
    if (!result.success) {
      throw new ConfigValidationError(
        formatZodErrors(result.error),
        configPath,
        result.error
      )
    }

    const validated = result.data
    return {
      config: {
        worktreePath: validated.worktreePath ?? defaults.worktreePath,
        copy: validated.copy ?? defaults.copy,
        symlink: validated.symlink ?? defaults.symlink,
        postCreate: validated.postCreate ?? defaults.postCreate,
      },
      source: 'file',
    }
  } catch (error) {
    if (error instanceof ConfigValidationError) throw error
    throw new ConfigValidationError(
      `Failed to load ${CONFIG_FILENAME}: ${(error as Error).message}`,
      configPath
    )
  }
}
```

**File**: `src/commands/config.ts`

Update references from `.wtrc.json` to `.wtrc.js`.

**File**: `src/utils/__tests__/config.test.ts`

Update tests to use `.wtrc.js` instead of `.wtrc.json`.

### Success Criteria

#### Automated Verification:
- [x] `bun run build` succeeds
- [x] `bun run lint` passes (no lint script, but typecheck passes)
- [x] `bun test` passes

#### Manual Verification:
- [ ] `.wtrc.js` is loaded correctly
- [ ] `wt config` shows configuration from `.wtrc.js`
- [ ] Invalid `.wtrc.js` shows proper error message

---

## Phase 3: Add `wt init` Command

### Changes Required

**File**: `src/commands/init.ts` (new file)

```typescript
/**
 * init - Initialize .wtrc.js in current repository
 */

import { Command } from 'commander'
import pc from 'picocolors'
import { join } from 'node:path'
import { getMainWorktreePath } from '../utils/git.js'

const DEFAULT_CONFIG = `export default {
  worktreePath: '$REPO-worktrees/$DIR',
  copy: [],
  symlink: [],
  postCreate: [],
}
`

export function initCommand() {
  const cmd = new Command('init')

  cmd.description('Initialize .wtrc.js configuration in current repository').action(async () => {
    try {
      const mainPath = await getMainWorktreePath()
      const configPath = join(mainPath, '.wtrc.js')

      const file = Bun.file(configPath)
      if (await file.exists()) {
        console.log(pc.yellow(`Config already exists: ${configPath}`))
        console.log(pc.gray('Run `wt config` to view current configuration'))
        return
      }

      await Bun.write(configPath, DEFAULT_CONFIG)

      console.log(pc.green(`Created: ${configPath}`))
      console.log(pc.gray('Run `wt config` to view configuration'))
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
```

**File**: `src/cli.ts`

Add import and register command:

```typescript
import { initCommand } from './commands/init.js'
// ...
program.addCommand(initCommand())
```

### Success Criteria

#### Automated Verification:
- [x] `bun run build` succeeds
- [x] `bun run lint` passes (typecheck passes)

#### Manual Verification:
- [ ] `./dist/cli.js init` creates `.wtrc.js` with defaults
- [ ] Running again shows "already exists" message with hint
- [ ] Created file is valid JS exporting correct structure

---

## Phase 4: Update Documentation & Cleanup

### Changes Required

**File**: `README.md`
- Remove mention of default action `wt <branch>`
- Add `wt init` command documentation
- Change all `.wtrc.json` references to `.wtrc.js`

**File**: `CLAUDE.md`
- Update CLI usage section
- Change config references to `.wtrc.js`

**Files to delete/rename**:
- Delete `.wtrc.example.json`
- Create `.wtrc.example.js`
- Rename `.wtrc.json` → `.wtrc.js` (this repo's config)

### Success Criteria

- [x] README accurately reflects new CLI behavior
- [x] CLAUDE.md is updated
- [x] No `.wtrc.json` references remain in codebase (except plan file)

---

## Implementation Order

1. Phase 1 (remove default action) - simplest, no dependencies
2. Phase 2 (migrate to .wtrc.js) - config refactor
3. Phase 3 (init command) - depends on phase 2
4. Phase 4 (docs & cleanup) - final cleanup
