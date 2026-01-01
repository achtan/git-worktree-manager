#!/usr/bin/env node

/**
 * wt - Git Worktree Manager
 *
 * Usage:
 *   wt <branch-name> [base-branch]  Create new worktree (default action)
 *   wt new <branch-name> [base-branch]  Create new worktree (explicit)
 *   wt list [options]               List all worktrees with status
 *   wt clean [options]              Remove merged/closed worktrees
 *   wt remove <name> [options]      Remove a specific worktree
 */

import { Command } from 'commander'
import { createRequire } from 'node:module'
import { newCommand } from './commands/new.js'
import { listCommand } from './commands/list.js'
import { cleanCommand } from './commands/clean.js'
import { removeCommand } from './commands/remove.js'
import { initCommand } from './commands/init.js'
import { configCommand } from './commands/config.js'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

const program = new Command()

program
  .name('wt')
  .description('Git Worktree Manager - Manage git worktrees with GitHub integration')
  .version(pkg.version, '-v, --version', 'output the version number')

// Add subcommands
program.addCommand(newCommand())
program.addCommand(listCommand())
program.addCommand(cleanCommand())
program.addCommand(removeCommand())
program.addCommand(initCommand())
program.addCommand(configCommand())

// Default action: if first arg doesn't match a subcommand, treat it as "new <branch>"
const args = process.argv.slice(2)
if (args.length > 0 && !['new', 'list', 'clean', 'remove', 'init', 'config', '-h', '--help', '-v', '--version'].includes(args[0])) {
  // Inject 'new' subcommand
  process.argv.splice(2, 0, 'new')
}

program.parse()
