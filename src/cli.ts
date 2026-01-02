#!/usr/bin/env bun

/**
 * wt - Git Worktree Manager
 *
 * Usage:
 *   wt new <branch-name> [base-branch]  Create new worktree
 *   wt list [options]                   List all worktrees with status
 *   wt clean [options]                  Remove merged/closed worktrees
 *   wt remove <name> [options]          Remove a specific worktree
 *   wt config                           Display current configuration
 *   wt init                             Initialize .wtrc.js configuration
 *   wt path [name]                      Select worktree and copy path to clipboard
 *   wt status                           Show status of current worktree
 */

import { Command } from 'commander'
import pkg from '../package.json'
import { cleanCommand } from './commands/clean.js'
import { configCommand } from './commands/config.js'
import { doctorCommand } from './commands/doctor.js'
import { initCommand } from './commands/init.js'
import { listCommand } from './commands/list.js'
import { newCommand } from './commands/new.js'
import { pathCommand } from './commands/path.js'
import { removeCommand } from './commands/remove.js'
import { statusCommand } from './commands/status.js'

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
program.addCommand(pathCommand())
program.addCommand(statusCommand())
program.addCommand(doctorCommand())

program.parse()
