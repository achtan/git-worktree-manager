---
date: 2026-01-01
author: daviddurika
git_commit: 13e2cb9
branch: main
repository: git-worktree-manager
topic: "Migrate to Biome"
tags: [plan, tooling, biome, linting, formatting]
---

# Migrate to Biome Implementation Plan

## Overview

Replace orphaned ESLint/Prettier config files with Biome for unified linting and formatting. Neither ESLint nor Prettier are installed as dependencies - only config files exist.

## Current State Analysis

- `eslint.config.mjs` - ESLint flat config with TypeScript rules (not installed)
- `.prettierrc` - Prettier settings: no semi, single quotes, 100 width (not installed)
- No `lint`/`format` scripts in package.json
- CLAUDE.md references non-existent lint/format commands

### Key Discoveries:
- ESLint/Prettier configs are orphaned - no dependencies in package.json:52-55
- Current Prettier settings: `semi: false`, `singleQuote: true`, `printWidth: 100`, `tabWidth: 2`
- ESLint rules: `no-unused-vars` (with `_` prefix ignore), `no-explicit-any` (warn)

## Desired End State

- Biome installed and configured
- `bun run lint`, `bun run format`, `bun run check` scripts available
- Codebase formatted consistently
- CLAUDE.md updated with correct commands
- Old ESLint/Prettier configs removed

## What We're NOT Doing

- Adding pre-commit hooks
- Configuring CI/CD integration
- Adding editor extensions/settings

## Implementation Approach

Single-phase migration since ESLint/Prettier aren't installed - just config replacement.

## Phase 1: Migrate to Biome

### Overview
Install Biome, configure to match current style, add scripts, clean up old configs, format codebase.

### Changes Required:

#### 1.1 Install Biome

```bash
bun add -d @biomejs/biome
```

#### 1.2 Create Biome Config

**File**: `biome.json`
**Changes**: Create new config matching current Prettier settings

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "semicolons": "asNeeded",
      "quoteStyle": "single",
      "trailingCommas": "all",
      "arrowParentheses": "always"
    }
  },
  "files": {
    "ignore": ["dist/", "node_modules/"]
  }
}
```

#### 1.3 Update package.json Scripts

**File**: `package.json`
**Changes**: Add lint, format, and check scripts

```json
{
  "scripts": {
    "check": "biome check src/",
    "check:fix": "biome check --write src/"
  }
}
```

#### 1.4 Update CLAUDE.md

**File**: `CLAUDE.md`
**Changes**: Update Development Commands section

```markdown
## Development Commands

```bash
# Build the project
bun run build

# Watch mode for development
bun run dev

# Type check
bun run typecheck

# Lint + format (check only)
bun run check

# Lint + format (with fixes)
bun run check:fix
```
```

#### 1.5 Remove Old Config Files

**Files to delete**:
- `eslint.config.mjs`
- `.prettierrc`

#### 1.6 Format Codebase

```bash
bun run check:fix
```

### Success Criteria:

#### Automated Verification:
- [ ] `bun run check` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run build` succeeds

#### Manual Verification:
- [ ] Verify formatted code looks correct
- [ ] Confirm no eslint.config.mjs or .prettierrc remain

## Testing Strategy

### Automated:
- Run `bun run check` to verify lint + format pass
- Run `bun run build` to verify no build breaks

### Manual:
- Review formatted files for unexpected changes

## References

- Biome docs: https://biomejs.dev/
- Current ESLint config: `eslint.config.mjs`
- Current Prettier config: `.prettierrc`
