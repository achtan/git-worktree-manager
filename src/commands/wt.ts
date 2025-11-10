#!/usr/bin/env node

/**
 * wt - Create new worktree with branch
 *
 * Usage: wt <branch-name>
 *
 * Creates a new Git worktree for the specified branch.
 */

import { Command } from 'commander';
import chalk from 'chalk';

const program = new Command();

program
  .name('wt')
  .description('Create new worktree with branch')
  .argument('<branch-name>', 'Name of the branch to create worktree for')
  .option('-p, --path <path>', 'Custom path for the worktree')
  .action(async (branchName: string, options: { path?: string }) => {
    console.log(chalk.blue(`Creating worktree for branch: ${branchName}`));
    if (options.path) {
      console.log(chalk.blue(`Custom path: ${options.path}`));
    }

    // TODO: Implement worktree creation logic
    // 1. Check if branch exists locally or remotely
    // 2. Determine worktree path (default or custom)
    // 3. Create worktree using git worktree add
    // 4. Handle branch creation if needed
    // 5. Optionally fetch PR info from GitHub

    console.log(chalk.yellow('TODO: Implementation pending'));
  });

program.parse();
