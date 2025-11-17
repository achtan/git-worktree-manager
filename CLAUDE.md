# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Build the project
npm run build

# Watch mode for development
npm run dev

# Lint TypeScript files
npm run lint

# Format code
npm run format

# Check formatting
npm run format:check
```

## Testing the CLI

```bash
# After building, test commands locally
npm run build
./dist/cli.js new feature/test
./dist/cli.js list
./dist/cli.js clean
```

## Architecture

### Core Philosophy
This is a Git worktree manager that creates worktrees in a `<repo>-worktrees/` directory adjacent to the main repository. Branch names with slashes (e.g., `feature/foo`) are converted to dashes for directory names (`feature-foo`).

### Key Components

**CLI Entry (`src/cli.ts`)**
- Uses Commander.js with subcommand pattern
- Supports default action: bare branch name (e.g., `wt feature/foo`) automatically invokes `new` command
- Commands: `new`, `list`, `clean`, `remove`

**Git Utilities (`src/utils/git.ts`)**
- All Git operations use `execa` to shell out to Git CLI
- `getRepoName()`: Gets repository name from main worktree (works even when called from within a worktree)
- `getDefaultBranch()`: Reads origin/HEAD, falls back to 'develop'
- `listWorktrees()`: Parses `git worktree list --porcelain` output
- `hasUnpushedCommits()`: Checks if branch has commits not pushed to remote (distinguishes between no remote vs. unpushed commits)

**GitHub Integration (`src/utils/github.ts`)**
- Uses Octokit with GitHub CLI authentication (`gh auth token`)
- `getPRStatus()`: Fetches PR state (open/draft/merged/closed), check runs status
- `parseGitHubRepo()`: Extracts owner/repo from Git remote URL (supports SSH and HTTPS)
- All GitHub features require `gh` CLI to be installed and authenticated

**Commands**
- `new`: Creates worktree, symlinks `.env`, copies `.claude/settings.local.json`, runs `post-worktree-created` hook from package.json
- `list`: Shows all worktrees with PR status, ahead/behind counts, uncommitted changes
- `clean`: Interactive removal of merged/closed worktrees with safety checks
- `remove`: Removes specific worktree by name

### Important Patterns

**Worktree Path Resolution**
- Worktrees are always created in `../<repo>-worktrees/<branch-name-with-dashes>/`
- Main worktree is identified as the first in `git worktree list` output

**Error Handling**
- Commands use spinners (ora) for long operations, stopped before error messages
- GitHub API errors fail gracefully (return null/default values)
- Validation happens before spinners start to avoid spinner cleanup on early exits

**GitHub Integration Flow**
1. Check `gh` CLI availability and authentication
2. Get remote URL from Git
3. Parse owner/repo from URL
4. Query GitHub API using Octokit
5. Gracefully degrade if any step fails

**Post-Worktree Hook**
- After creating worktree, checks for `post-worktree-created` script in package.json
- Executes hook with `npm run post-worktree-created` in the new worktree directory
- Default hook: `npm install`

## TypeScript Configuration

- ES2022 target with Node16 module resolution
- Strict mode enabled
- Output to `dist/` directory
- Uses `.js` extensions in imports (ESM requirement)
