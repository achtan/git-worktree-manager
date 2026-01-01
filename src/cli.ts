#!/usr/bin/env bun

/**
 * wt - Git Worktree Manager
 *
 * Usage:
 *   wt new <branch-name> [base-branch]  Create new worktree
 *   wt list [options]                   List all worktrees with status
 *   wt clean [options]                  Remove merged/closed worktrees
 *   wt remove <name> [options]          Remove a specific worktree
 *   wt init                             Initialize .wtrc.js configuration
 */

import { Command } from 'commander'
import pkg from '../package.json'
import { cleanCommand } from './commands/clean.js'
import { configCommand } from './commands/config.js'
import { initCommand } from './commands/init.js'
import { listCommand } from './commands/list.js'
import { newCommand } from './commands/new.js'
import { removeCommand } from './commands/remove.js'

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
program.addCommand(configCommand())
program.addCommand(initCommand())

program.parse()
