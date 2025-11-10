#!/usr/bin/env node

/**
 * wtclean - Remove merged/closed worktrees
 *
 * Usage: wtclean [options]
 *
 * Removes worktrees for branches that have been merged or had their PRs closed.
 */

import { Command } from 'commander';
import chalk from 'chalk';

const program = new Command();

program
  .name('wtclean')
  .description('Remove merged/closed worktrees')
  .option('-d, --dry-run', 'Show what would be removed without actually removing')
  .option('-f, --force', 'Force removal even with uncommitted changes')
  .option('--merged-only', 'Only remove worktrees for merged branches')
  .option('--closed-only', 'Only remove worktrees for closed PRs')
  .action(
    async (options: {
      dryRun?: boolean;
      force?: boolean;
      mergedOnly?: boolean;
      closedOnly?: boolean;
    }) => {
      console.log(chalk.blue('Cleaning up worktrees...'));

      // TODO: Implement worktree cleanup logic
      // 1. Get list of all worktrees
      // 2. Check each worktree's branch status
      // 3. Query GitHub API for PR status (merged/closed)
      // 4. Identify candidates for removal
      // 5. Show list and confirm with user (unless --force)
      // 6. Remove worktrees using git worktree remove
      // 7. Clean up local branches if desired

      if (options.dryRun) {
        console.log(chalk.blue('Dry run mode - no changes will be made'));
      }
      if (options.force) {
        console.log(chalk.yellow('Force mode - will remove with uncommitted changes'));
      }
      if (options.mergedOnly) {
        console.log(chalk.blue('Only removing merged branches'));
      }
      if (options.closedOnly) {
        console.log(chalk.blue('Only removing closed PRs'));
      }

      console.log(chalk.yellow('TODO: Implementation pending'));
    }
  );

program.parse();
