# Config System - Detailed Implementation Plan

## Overview

Replace hardcoded file copying and hook logic in `new` command with a configurable `.wtrc.json` system supporting glob patterns, symlinks, and custom post-create commands.

## Decisions

- **Symlinks:** Separate `symlink` array (not mixed with `copy`)
- **Command name:** `postCreate` (clear timing, matches conventions)
- **Command execution:** Shell mode (`shell: true`)
- **Copy failures:** Warn but continue
- **CLI flags:** None (keep simple)

---

## Phase 1: Config Loading Foundation

**Goal:** Create config utility that loads and parses `.wtrc.json` with proper defaults.

### Files to Create
- `src/utils/config.ts`

### Implementation Details

```typescript
interface WtConfig {
  worktreePath: string
  copy: string[]
  symlink: string[]
  postCreate: string[]
}

function loadConfig(mainWorktreePath: string): Promise<WtConfig>
function getDefaults(): WtConfig
```

**Behavior:**
- Look for `.wtrc.json` in `mainWorktreePath`
- If found, parse and merge with defaults
- If not found or invalid JSON, return defaults
- Defaults: `{ worktreePath: "$REPO-worktrees/$DIR", copy: [], symlink: [], postCreate: [] }`

### Validation Criteria
1. Create test `.wtrc.json` in project root
2. Run simple script that calls `loadConfig()` and logs result
3. Verify:
   - Returns defaults when no config file
   - Parses valid config correctly
   - Handles malformed JSON gracefully (returns defaults + warning)

### Implementation Status
- [ ] `src/utils/config.ts` created
- [ ] `loadConfig()` function implemented
- [ ] `getDefaults()` function implemented
- [ ] Validation criteria verified

---

## Phase 2: Template Variable Resolution

**Goal:** Add template variable substitution for config values.

### Files to Modify
- `src/utils/config.ts`

### Implementation Details

```typescript
interface TemplateVariables {
  PATH: string    // Full worktree path
  BRANCH: string  // Original branch name (e.g., "feature/auth")
  DIR: string     // Directory name with dashes (e.g., "feature-auth")
  REPO: string    // Repository name
}

function resolveTemplate(template: string, vars: TemplateVariables): string
function resolveConfig(config: WtConfig, vars: TemplateVariables): WtConfig
```

**Behavior:**
- Replace `$PATH`, `$BRANCH`, `$DIR`, `$REPO` in strings
- Apply to `worktreePath` and each `postCreate` command
- `copy` and `symlink` patterns are NOT resolved (they're relative to main worktree)

### Validation Criteria
1. Unit test with various templates:
   - `"$REPO-worktrees/$DIR"` → `"my-repo-worktrees/feature-auth"`
   - `"webstorm $PATH &"` → `"webstorm /full/path/to/worktree &"`
   - `"echo $BRANCH"` → `"echo feature/auth"`
2. Verify edge cases: no variables, unknown variables left as-is

### Implementation Status
- [ ] `TemplateVariables` interface added
- [ ] `resolveTemplate()` function implemented
- [ ] `resolveConfig()` function implemented
- [ ] Validation criteria verified

---

## Phase 3: Glob-Based File Operations

**Goal:** Replace hardcoded file copying with glob pattern matching for both copy and symlink.

### Dependencies
- Add `globby` package

### Files to Modify
- `package.json` - add globby dependency
- `src/commands/new.ts` - replace file copying logic

### Implementation Details

```typescript
import { globby } from 'globby'

async function copyConfigFiles(options: {
  mainWorktreePath: string
  worktreePath: string
  copyPatterns: string[]
  symlinkPatterns: string[]
}): Promise<void>
```

**Behavior:**
- Use `globby` with patterns from `config.copy` and `config.symlink`
- Patterns are gitignore-style: `!` prefix for negation
- For `copy`: copy each matched file, preserving directory structure
- For `symlink`: create symlink to source file
- Create parent directories as needed
- On failure: warn but continue (don't fail command)

**Pattern Examples:**
- `.env` - single file
- `.idea/**` - entire directory
- `!.idea/workspace.xml` - exclude specific file
- `.vscode/**` - entire directory

### Validation Criteria
1. Create `.wtrc.json` with:
   ```json
   {
     "copy": [".idea/**", "!.idea/workspace.xml"],
     "symlink": [".env"]
   }
   ```
2. Run `wt new test/branch`
3. Verify:
   - `.env` is symlinked (not copied)
   - `.idea/` contents copied except `workspace.xml`
   - Non-existent patterns silently skipped
   - Permission errors logged as warnings

### Implementation Status
- [ ] `globby` package added to dependencies
- [ ] `copyConfigFiles()` function implemented
- [ ] Copy logic with directory preservation working
- [ ] Symlink logic working
- [ ] Validation criteria verified

---

## Phase 4: Post-Create Command Execution

**Goal:** Replace `post-worktree-created` hook with configurable post-create commands.

### Files to Modify
- `src/commands/new.ts`

### Implementation Details

```typescript
async function runPostCreateCommands(options: {
  worktreePath: string
  commands: string[]
  variables: TemplateVariables
}): Promise<void>
```

**Behavior:**
- Execute commands sequentially in worktree directory
- Use shell execution (`shell: true`) for all commands
- If command ends with ` &`, spawn detached (don't wait)
- Otherwise, execute blocking and wait for completion
- Stop on first blocking command failure
- Log each command before execution

**Implementation:**
```typescript
import { spawn } from 'child_process'

for (const command of commands) {
  const resolved = resolveTemplate(command, variables)

  if (resolved.endsWith(' &')) {
    const cmd = resolved.slice(0, -2).trim()
    spawn(cmd, {
      cwd: worktreePath,
      shell: true,
      detached: true,
      stdio: 'ignore'
    }).unref()
  } else {
    const child = spawn(resolved, {
      cwd: worktreePath,
      shell: true,
      stdio: 'inherit'
    })
    await new Promise((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) resolve(undefined)
        else reject(new Error(`Command failed with code ${code}`))
      })
    })
  }
}
```

### Validation Criteria
1. Create `.wtrc.json` with:
   ```json
   { "postCreate": ["echo 'Starting'", "npm install", "code $PATH &"] }
   ```
2. Run `wt new test/branch`
3. Verify:
   - "Starting" echoed
   - `npm install` runs and completes
   - VS Code opens (detached, doesn't block)
   - Process exits cleanly

### Implementation Status
- [ ] `runPostCreateCommands()` function implemented
- [ ] Blocking command execution working
- [ ] Detached command execution (` &` suffix) working
- [ ] Template variable resolution in commands working
- [ ] Validation criteria verified

---

## Phase 5: Config Command

**Goal:** Add `wt config` command to view current configuration.

### Files to Create
- `src/commands/config.ts`

### Files to Modify
- `src/cli.ts` - register command

### Implementation Details

```typescript
// wt config - display current config
// Shows:
// - Config file path (or "No config file found")
// - Resolved config values
// - Example resolved paths for current context
```

**Output Example:**
```
Config: /path/to/repo/.wtrc.json

worktreePath: $REPO-worktrees/$DIR
             → my-repo-worktrees/<branch>

copy:
  - .idea/**
  - !.idea/workspace.xml
  - .vscode/**

symlink:
  - .env

postCreate:
  - npm install
  - code $PATH &
```

### Validation Criteria
1. Run `wt config` with no config file → shows defaults
2. Run `wt config` with config file → shows merged config
3. Output is readable and shows both template and resolved values

### Implementation Status
- [ ] `src/commands/config.ts` created
- [ ] Command registered in `src/cli.ts`
- [ ] Config display formatting implemented
- [ ] Validation criteria verified

---

## Phase 6: Remove Legacy Code

**Goal:** Clean up old hardcoded logic from `new.ts`.

### Files to Modify
- `src/commands/new.ts`

### Changes
1. Remove hardcoded `.env` symlink logic (lines 80-87)
2. Remove hardcoded `.claude/settings.local.json` copy (lines 89-97)
3. Remove hardcoded `.idea` copy logic (lines 99-147)
4. Remove `post-worktree-created` hook from package.json support (lines 152-177)

### Validation Criteria
1. Verify `wt new` works with config
2. Verify `wt new` works without config (empty defaults = no copying)
3. No references to old patterns remain

### Implementation Status
- [ ] Hardcoded `.env` symlink logic removed
- [ ] Hardcoded `.claude/settings.local.json` copy removed
- [ ] Hardcoded `.idea` copy logic removed
- [ ] `post-worktree-created` hook support removed
- [ ] Validation criteria verified

---

## Phase 7: Documentation

**Goal:** Update README and add example config.

### Files to Modify
- `README.md` - add config section

### Files to Create
- `.wtrc.example.json` - example config file

### Content
- Document all config options
- Document template variables
- Provide example configs for common setups

### Validation Criteria
1. README accurately describes feature
2. Example config is valid JSON
3. Copy example, rename to `.wtrc.json`, verify it works

### Implementation Status
- [ ] README.md updated with config section
- [ ] `.wtrc.example.json` created
- [ ] Template variables documented
- [ ] Validation criteria verified

---

## Migration Path

For existing users:
1. No config file = no file copying, no hooks (breaking change)
2. Users need to create `.wtrc.json` to restore previous behavior

**Example migration config (replicates current hardcoded behavior):**
```json
{
  "copy": [
    ".claude/settings.local.json",
    ".idea/runConfigurations/**",
    ".idea/codeStyles/**",
    ".idea/inspectionProfiles/**",
    ".idea/scopes/**",
    ".idea/modules.xml",
    ".idea/vcs.xml",
    ".idea/encodings.xml",
    ".idea/misc.xml",
    ".idea/*.iml"
  ],
  "symlink": [
    ".env"
  ],
  "postCreate": [
    "npm install"
  ]
}
```
