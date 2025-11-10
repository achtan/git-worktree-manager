# Git Worktree Manager

A command-line tool for managing Git worktrees efficiently with GitHub integration. Work with multiple Git branches simultaneously without switching contexts.

## Features

- Create worktrees for branches quickly
- List all worktrees with status information
- Automatically clean up merged/closed worktrees
- GitHub integration for PR status
- Uses existing GitHub CLI authentication

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

### `wt <branch-name>`

Create a new worktree for the specified branch.

```bash
# Create worktree for existing branch
wt feature/new-feature

# Create worktree with custom path
wt feature/new-feature --path ../feature-work
```

**Options:**
- `-p, --path <path>` - Custom path for the worktree

### `wtlist`

List all worktrees with their status.

```bash
# List all worktrees
wtlist

# Verbose output with detailed information
wtlist --verbose

# JSON output format
wtlist --json
```

**Options:**
- `-v, --verbose` - Show detailed information
- `--json` - Output in JSON format

### `wtclean`

Remove worktrees for merged/closed branches.

```bash
# Clean up merged worktrees (with confirmation)
wtclean

# Dry run to see what would be removed
wtclean --dry-run

# Force removal even with uncommitted changes
wtclean --force

# Only remove merged branches
wtclean --merged-only

# Only remove closed PRs
wtclean --closed-only
```

**Options:**
- `-d, --dry-run` - Show what would be removed without actually removing
- `-f, --force` - Force removal even with uncommitted changes
- `--merged-only` - Only remove worktrees for merged branches
- `--closed-only` - Only remove worktrees for closed PRs

## GitHub Integration

This tool integrates with GitHub to provide additional functionality:

- Check PR status (open/closed/merged)
- Automatically identify branches safe to clean up
- Display PR information in worktree listings

**Authentication:** Uses existing GitHub CLI authentication. Make sure you're logged in:

```bash
gh auth login
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
