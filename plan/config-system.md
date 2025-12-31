# Config System Implementation Plan

## Summary
Add `.wtrc.json` config file support with glob-based file copying, symlinks, and customizable post-create hooks.

## Config File

**Location:** `.wtrc.json` in project root (no global config for now)

**Schema:**
```json
{
  "worktreePath": "$REPO-worktrees/$DIR",
  "copy": [
    ".idea/**",
    "!.idea/workspace.xml",
    ".vscode/**",
    ".claude/settings.local.json"
  ],
  "symlink": [
    ".env"
  ],
  "postCreate": [
    "npm install",
    "webstorm $PATH &"
  ]
}
```

## Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `worktreePath` | string | `$REPO-worktrees/$DIR` | Template for worktree location (relative to main repo parent) |
| `copy` | string[] | `[]` | Gitignore-style patterns for files to copy, `!` for negation |
| `symlink` | string[] | `[]` | Gitignore-style patterns for files to symlink |
| `postCreate` | string[] | `[]` | Commands to run after creation, `&` suffix = background/detached |

## Template Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `$PATH` | Full worktree path | `/home/user/projects/repo-worktrees/feature-auth` |
| `$BRANCH` | Original branch name | `feature/auth` |
| `$DIR` | Directory name (dashes) | `feature-auth` |
| `$REPO` | Repository name | `my-repo` |

## Files to Create/Modify

### New Files
- `src/utils/config.ts` - Config loading, parsing, template resolution
- `src/commands/config.ts` - `wt config` command (view only)

### Modified Files
- `src/commands/new.ts` - Replace hardcoded file copying with config-based
- `src/cli.ts` - Register `wt config` command
- `package.json` - Add `globby` dependency

## Implementation Steps

### 1. Create config utility (`src/utils/config.ts`)
- `loadConfig()` - Load `.wtrc.json` from main worktree root
- `resolveTemplate(template, variables)` - Replace `$VAR` with values
- `getDefaults()` - Return default config when no file exists
- Type definitions for config schema

### 2. Create config command (`src/commands/config.ts`)
- `wt config` - Display current config (merged defaults + file)
- Show where config is loaded from
- Show resolved values for current context

### 3. Update new command (`src/commands/new.ts`)
- Load config at start
- Replace hardcoded file copy logic with:
  - Use `globby` with patterns from `config.copy`
  - Copy matched files to new worktree
  - Symlink files matching `config.symlink` patterns
- Replace hardcoded hook with:
  - Execute each command in `config.postCreate`
  - Use shell execution (`shell: true`)
  - Parse `&` suffix to determine blocking vs detached
- Use `config.worktreePath` for path resolution
- Remove `post-worktree-created` package.json hook support

### 4. Add globby dependency
- `npm install globby`

## Command Execution Logic

```
for each command in postCreate:
  resolvedCmd = resolveTemplate(command, variables)
  if resolvedCmd ends with " &":
    spawn(resolvedCmd.slice(0, -2), { shell: true, detached: true })
  else:
    spawn(resolvedCmd, { shell: true })  // blocking
```

## Error Handling

- **Copy/symlink failures:** Warn but continue (don't fail the command)
- **postCreate command failures:** Stop on first blocking command failure

## Config Resolution

1. If `.wtrc.json` exists → use it (merged with defaults)
2. If no config → no file copying, no symlinks, no hooks (empty defaults)
