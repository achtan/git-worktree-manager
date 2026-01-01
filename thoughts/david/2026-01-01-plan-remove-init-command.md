---
date: 2026-01-01
author: david
topic: "Remove wt init command"
tags: [plan, cleanup, refactor]
---

# Remove `wt init` Command

## Overview

Remove the `wt init` command and all related code/documentation. The command outputs a hardcoded shell function `wtl` for `.zshrc` integration.

## Current State

- `src/commands/init.ts` - Exports `initCommand()` returning a Commander command that outputs a shell function
- `src/cli.ts` - Imports and registers the init command
- `README.md` - Documents the init command usage

## Desired End State

- No `init` command exists
- No references to `init` in CLI
- No documentation for `init`
- Build passes, lint passes

## What We're NOT Doing

- Removing the `wtl` shell function concept from README entirely (user can still manually add their own)
- Modifying any other commands

## Implementation

### Phase 1: Remove Code

#### 1.1 Delete init command file

**File**: `src/commands/init.ts`
**Action**: Delete file

#### 1.2 Update CLI entry point

**File**: `src/cli.ts`

Remove import (line 20):
```typescript
import { initCommand } from './commands/init.js'
```

Remove command registration (line 38):
```typescript
program.addCommand(initCommand())
```

Remove from default action check (line 43):
```typescript
// Change from:
['new', 'list', 'clean', 'remove', 'init', 'config', '-h', '--help', '-v', '--version']
// To:
['new', 'list', 'clean', 'remove', 'config', '-h', '--help', '-v', '--version']
```

### Phase 2: Update Documentation

#### 2.1 Update README.md

**File**: `README.md`

Remove shell integration section (lines 46-58):
```markdown
### Shell Integration

For the full workflow (create worktree → cd into it → open IDE → start Claude):

```bash
# Add to ~/.zshrc
eval "$(wt init)"

# To initialize a new worktree and branch call
wt feature/my-feature
# To navigate to it, open WebStorm, and start Claude, run:
wtl ../repo-worktrees/feature-my-feature
```
```

Remove `### wt init` section (lines 242-260):
```markdown
### `wt init`

Output shell function for `~/.zshrc` integration...
```

### Success Criteria

#### Automated Verification:
- [ ] Build passes: `npm run build`
- [ ] Lint passes: `npm run lint`
- [ ] No references to `init` in `src/` (except possibly in comments about what was removed)

#### Manual Verification:
- [ ] `wt --help` does not show `init` command
- [ ] `wt init` shows error (unknown command)

## References

- `src/commands/init.ts:1-13` - Current implementation
- `src/cli.ts:20,38,43` - CLI references
- `README.md:46-58,242-260` - Documentation
