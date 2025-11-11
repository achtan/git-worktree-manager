#!/usr/bin/env node

/**
 * wt - Git Worktree Manager
 *
 * Usage:
 *   wt <branch-name> [base-branch]  Create new worktree (default action)
 *   wt new <branch-name> [base-branch]  Create new worktree (explicit)
 *   wt list [options]               List all worktrees with status
 *   wt clean [options]              Remove merged/closed worktrees
 */

import { Command } from 'commander'
import { newCommand } from './commands/new.js'
import { listCommand } from './commands/list.js'
import { cleanCommand } from './commands/clean.js'

const program = new Command()

program
  .name('wt')
  .description('Git Worktree Manager - Manage git worktrees with GitHub integration')
  .version('1.0.0')

// Add subcommands
program.addCommand(newCommand())
program.addCommand(listCommand())
program.addCommand(cleanCommand())

// Default action: if first arg doesn't match a subcommand, treat it as "new <branch>"
const args = process.argv.slice(2)
if (args.length > 0 && !['new', 'list', 'clean', '-h', '--help', '-V', '--version'].includes(args[0])) {
  // Inject 'new' subcommand
  process.argv.splice(2, 0, 'new')
}

program.parse()
