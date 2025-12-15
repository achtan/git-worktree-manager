# Git Worktree Manager

A command-line tool for managing Git worktrees efficiently with GitHub integration. Work with multiple Git branches simultaneously without switching contexts.

## Features

- **Quick Worktree Creation** - Create new worktrees with a simple command
- **Status Overview** - List all worktrees with PR status, checks, and branch info
- **Smart Cleanup** - Automatically remove worktrees for merged/closed PRs
- **Abandoned Folder Detection** - Find and remove leftover directories without `.git`
- **Orphan Worktree Detection** - Find and remove worktrees with broken gitdir references
- **GitHub Integration** - Real-time PR status (open/draft/merged/closed)
- **Visual Feedback** - Loading spinners for long-running operations
- **Interactive Prompts** - Checkbox selection for cleanup, confirms before destructive operations
- **Uncommitted Changes Detection** - Prevents accidental data loss
- **IDE Settings Sync** - Copies WebStorm `.idea` settings to new worktrees

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
### `wt new <branch-name> [base-branch]`

Create a new worktree for a new branch. Worktrees are created in `../<repo>-worktrees/` directory.

```bash
# Create worktree from default branch (shorthand)
wt feature/new-feature

# Create worktree from default branch (explicit)
wt new feature/new-feature

# Create worktree from specific base branch
wt new feature/new-feature develop
```

**Arguments:**
- `<branch-name>` - Name of the new branch to create
- `[base-branch]` - Base branch to create from (default: auto-detected from origin/HEAD)

**Behavior:**
- Automatically creates the worktree directory structure
- Converts slashes in branch names to dashes for directory names (e.g., `feature/foo` → `feature-foo`)
- Shows spinner during creation
- Fails if branch already exists locally
- Symlinks `.env` file from main worktree if present
- Copies `.claude/settings.local.json` from main worktree if present
- Copies WebStorm `.idea` settings from main worktree (run configurations, code styles, inspection profiles, scopes, and project files)

### `wt list`

List all worktrees with their status, PR information, and branch details.

```bash
# List all worktrees with status
wt list

# JSON output format
wt list --json
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
💡 Run 'wt clean' to remove 1 merged/closed worktree(s)
```

### `wt clean`

Remove worktrees for branches with merged or closed PRs, abandoned folders, and orphan worktrees. Uses interactive checkbox selection.

```bash
# Clean up merged/closed worktrees (interactive)
wt clean

# Dry run to see what would be removed
wt clean --dry-run

# Skip interactive selection (select all)
wt clean --force
```

**Options:**
- `-d, --dry-run` - Show what would be removed without actually removing
- `-f, --force` - Skip interactive selection (removes all cleanable items)

**What it detects:**
- **Merged/Closed worktrees** - Worktrees with merged or closed PRs
- **Abandoned folders** - Directories in worktrees folder without `.git` (leftover from manual deletions)
- **Orphan worktrees** - Directories with `.git` file pointing to non-existent gitdir

**Safety features:**
- Shows spinner while checking PR status
- Automatically skips worktrees with uncommitted changes (warns user)
- Skips the current worktree
- Interactive checkbox selection to choose what to remove
- Automatically deletes local branch when removing worktree
- Only processes worktrees in `<repo>-worktrees/` directory

**Example flow:**
```
Scanning worktrees...
Checking PR status...
Scanning for abandoned folders...

⚠ Skipped (uncommitted changes):
  bugfix-draft (bugfix/draft)

? Select worktrees to remove:
❯ ◯ feature-old (MERGED)
  ◯ bugfix-done (CLOSED)
  ◯ leftover-dir (abandoned)
  ◯ broken-wt (orphan)

Removing feature-old...
✓ Removed: feature-old (branch deleted)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Cleaned up 1 worktree(s)!
Run 'wt list' to see remaining worktrees.
```

### `wt remove <name>`

Remove a specific worktree by name. Interactive with safety prompts for uncommitted changes and unpushed commits.

```bash
# Remove by branch name
wt remove feature/my-feature

# Remove by directory name
wt remove feature-my-feature

# Keep the local branch (only remove worktree)
wt remove feature/my-feature --keep-branch

# Force removal (skip all prompts)
wt remove feature/my-feature --force
```

**Arguments:**
- `<name>` - Worktree name (matches branch name or directory name)

**Options:**
- `--keep-branch` - Keep the local branch after removing the worktree
- `-f, --force` - Force removal even with uncommitted changes or unpushed commits

**Safety features:**
- Shows uncommitted changes before removal
- Option to view diff before discarding changes
- Warns about unpushed commits before branch deletion
- Warns about branches with no remote tracking
- Interactive prompts to abort, keep branch, or proceed

**Example flow:**
```
Worktree: feature-my-feature
  Path: /path/to/repo-worktrees/feature-my-feature
  Branch: feature/my-feature

⚠ Uncommitted changes detected:

Modified:
  src/file.ts

? What would you like to do?
❯ Show diff
  Discard changes and remove
  Abort

✓ Removed worktree: feature-my-feature
✓ Deleted branch: feature/my-feature

Run 'wt list' to see remaining worktrees
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
- `wt list` will show "no-pr" status for all worktrees
- `wt clean` requires GitHub CLI and won't work without it

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
wt list
# Shows: feature-add-auth (open)

# After PR is merged, clean up
wt clean
# Removes merged worktree and deletes branch
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
│   ├── cli.ts        # Main CLI entry point
│   ├── commands/     # CLI command implementations
│   │   ├── new.ts    # Create worktree command
│   │   ├── list.ts   # List worktrees command
│   │   ├── clean.ts  # Clean worktrees command
│   │   └── remove.ts # Remove specific worktree command
│   └── utils/        # Utility functions
│       ├── git.ts    # Git operations
│       └── github.ts # GitHub API helpers
├── dist/             # Compiled output
└── package.json
```

## License

MIT
