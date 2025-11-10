#!/usr/bin/env node

/**
 * wtlist - List all worktrees with status
 *
 * Usage: wtlist [options]
 *
 * Displays all Git worktrees with their status information.
 */

import { Command } from 'commander';
import chalk from 'chalk';

const program = new Command();

program
  .name('wtlist')
  .description('List all worktrees with status')
  .option('-v, --verbose', 'Show detailed information')
  .option('--json', 'Output in JSON format')
  .action(async (options: { verbose?: boolean; json?: boolean }) => {
    console.log(chalk.blue('Listing all worktrees...'));

    // TODO: Implement worktree listing logic
    // 1. Get list of worktrees using git worktree list
    // 2. Parse worktree information (path, branch, commit)
    // 3. Get status for each worktree (dirty, clean, etc.)
    // 4. Optionally fetch GitHub PR status
    // 5. Format output (table or JSON)

    if (options.verbose) {
      console.log(chalk.blue('Verbose mode enabled'));
    }
    if (options.json) {
      console.log(chalk.blue('JSON output format'));
    }

    console.log(chalk.yellow('TODO: Implementation pending'));
  });

program.parse();
