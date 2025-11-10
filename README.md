# Git Worktree Manager

A command-line tool for managing Git worktrees efficiently with GitHub integration. Work with multiple Git branches simultaneously without switching contexts.

## Features

- **Quick Worktree Creation** - Create new worktrees with a simple command
- **Status Overview** - List all worktrees with PR status, checks, and branch info
- **Smart Cleanup** - Automatically remove worktrees for merged/closed PRs
- **GitHub Integration** - Real-time PR status (open/draft/merged/closed)
- **Visual Feedback** - Loading spinners for long-running operations
- **Interactive Prompts** - Confirms before destructive operations
- **Uncommitted Changes Detection** - Prevents accidental data loss

## Requirements

- Node.js 22+
- Git
- GitHub CLI (`gh`) authenticated (for GitHub features)

## Installation

### Global Installation

```bash
npm install -g .
```

### Development

```bash
npm install
npm run build
```

## Commands

### `wt <branch-name> [base-branch]`

Create a new worktree for a new branch. Worktrees are created in `../<repo>-worktrees/` directory.

```bash
# Create worktree from default branch (main/develop)
wt feature/new-feature

# Create worktree from specific base branch
wt feature/new-feature develop
```

**Arguments:**
- `<branch-name>` - Name of the new branch to create
- `[base-branch]` - Base branch to create from (default: auto-detected from origin/HEAD)

**Behavior:**
- Automatically creates the worktree directory structure
- Converts slashes in branch names to dashes for directory names (e.g., `feature/foo` → `feature-foo`)
- Shows spinner during creation
- Fails if branch already exists locally

### `wtlist`

List all worktrees with their status, PR information, and branch details.

```bash
# List all worktrees with status
wtlist

# JSON output format
wtlist --json
```

**Options:**
- `--json` - Output in JSON format (disables spinner)

**Output includes:**
- Worktree directory name
- PR status (open/draft/merged/closed/no-pr)
- Branch ahead/behind counts relative to default branch
- Uncommitted changes indicator
- CI check status (passing/failing)
- Current worktree indicator
- PR URL (if available)
- Summary statistics

**Example output:**
```
Worktrees for my-repo:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

feature-auth                             open (↑3 ↓0)
  Branch: feature/auth
  PR: https://github.com/owner/repo/pull/123

bugfix-login                             merged (↑0 ↓2)
  Branch: bugfix/login

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summary: 2 worktrees (1 open, 1 merged)
💡 Run 'wtclean' to remove 1 merged/closed worktree(s)
```

### `wtclean`

Remove worktrees for branches with merged or closed PRs. Interactive with confirmation prompts.

```bash
# Clean up merged/closed worktrees (with confirmation)
wtclean

# Dry run to see what would be removed
wtclean --dry-run

# Skip confirmation prompt
wtclean --force
```

**Options:**
- `-d, --dry-run` - Show what would be removed without actually removing
- `-f, --force` - Skip confirmation prompt (still asks per branch deletion)

**Safety features:**
- Shows spinner while checking PR status
- Automatically skips worktrees with uncommitted changes (warns user)
- Skips the current worktree
- Requires confirmation before removing
- Asks whether to delete local branch for each removed worktree
- Only processes worktrees in `<repo>-worktrees/` directory

**Example flow:**
```
Scanning worktrees...
Checking PR status...

Cleanable worktrees:

feature-old (MERGED)
  Branch: feature/old

⚠ Skipped (uncommitted changes):

bugfix-draft (CLOSED)
  Branch: bugfix/draft

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Remove 1 worktree(s)? (y/N): y

✓ Removed worktree: feature-old
  Delete branch 'feature/old'? (y/N): y
  ✓ Deleted branch: feature/old
```

## GitHub Integration

This tool integrates with GitHub to provide rich PR information:

- **PR Status** - Displays open/draft/merged/closed state
- **PR URLs** - Direct links to pull requests
- **CI Checks** - Shows if checks are passing or failing
- **Smart Cleanup** - Identifies branches safe to remove based on PR state
- **Draft Detection** - Shows when PRs are in draft state

### Authentication

Uses existing GitHub CLI (`gh`) authentication. Make sure you're logged in:

```bash
gh auth login
```

The tool will show helpful error messages if:
- `gh` CLI is not installed
- You're not authenticated
- The repository doesn't have a GitHub remote

### Without GitHub

The tool works without GitHub integration, but with limited functionality:
- `wtlist` will show "no-pr" status for all worktrees
- `wtclean` requires GitHub CLI and won't work without it

## Workflow Example

Here's a typical workflow using these tools:

```bash
# Create a new worktree for a feature
wt feature/add-auth

# Navigate to the worktree
cd ../my-repo-worktrees/feature-add-auth

# Work on your feature...
git add .
git commit -m "Add authentication"
git push -u origin feature/add-auth

# Create PR via gh CLI
gh pr create --title "Add authentication" --body "Implements user auth"

# Check status of all worktrees
wtlist
# Shows: feature-add-auth (open)

# After PR is merged, clean up
wtclean
# Removes merged worktree and optionally deletes branch
```

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

### Linting

```bash
npm run lint
npm run format
```

## Project Structure

```
git-worktree-manager/
├── src/
│   ├── commands/     # CLI command implementations
│   │   ├── wt.ts
│   │   ├── wtlist.ts
│   │   └── wtclean.ts
│   └── utils/        # Utility functions
│       ├── git.ts    # Git operations
│       └── github.ts # GitHub API helpers
├── dist/             # Compiled output
└── package.json
```

## License

MIT
