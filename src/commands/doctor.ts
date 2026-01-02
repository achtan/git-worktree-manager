/**
 * doctor - Environment diagnostics
 */

import { dirname, join } from 'node:path'
import { Command } from 'commander'
import pc from 'picocolors'
import { loadConfig } from '../utils/config.js'
import { exec } from '../utils/exec.js'
import { getRepoName, listWorktrees } from '../utils/git.js'
import { isGhCliAvailable } from '../utils/github.js'

interface CheckResult {
  status: 'pass' | 'warn' | 'info' | 'fail'
  label: string
  detail?: string
}

export function doctorCommand() {
  const cmd = new Command('doctor')

  cmd.description('Check environment and configuration').action(async () => {
    console.log()
    console.log(pc.bold('Checks:'))

    const results: CheckResult[] = []

    // Check 1: Git installed
    try {
      const { stdout } = await exec('git', ['--version'])
      const version = stdout.match(/git version ([\d.]+)/)?.[1] || stdout.trim()
      results.push({ status: 'pass', label: 'Git', detail: version })
    } catch {
      results.push({ status: 'fail', label: 'Git', detail: 'not installed' })
    }

    // Check 2: Inside git repo
    try {
      await exec('git', ['rev-parse', '--git-dir'])
      const repoName = await getRepoName()
      results.push({ status: 'pass', label: 'Repository', detail: repoName })
    } catch {
      results.push({ status: 'fail', label: 'Repository', detail: 'not a git repository' })
    }

    // Check 3: gh CLI installed
    const ghStatus = await isGhCliAvailable()
    if (!ghStatus.available) {
      results.push({
        status: 'warn',
        label: 'GitHub CLI',
        detail: 'not installed (install: https://cli.github.com)',
      })
    } else {
      try {
        const { stdout } = await exec('gh', ['--version'])
        const version = stdout.match(/gh version ([\d.]+)/)?.[1] || 'installed'
        results.push({ status: 'pass', label: 'GitHub CLI', detail: version })
      } catch {
        results.push({ status: 'pass', label: 'GitHub CLI', detail: 'installed' })
      }
    }

    // Check 4: gh authenticated
    if (ghStatus.available) {
      if (ghStatus.authenticated) {
        try {
          const { stdout } = await exec('gh', ['auth', 'status'])
          const userMatch = stdout.match(/Logged in to github\.com account (\S+)/)
          const user = userMatch ? userMatch[1] : 'authenticated'
          results.push({ status: 'pass', label: 'GitHub auth', detail: user })
        } catch {
          results.push({ status: 'pass', label: 'GitHub auth', detail: 'authenticated' })
        }
      } else {
        results.push({
          status: 'warn',
          label: 'GitHub auth',
          detail: 'not authenticated (run: gh auth login)',
        })
      }
    }

    // Check 5: Worktrees directory
    try {
      const repoName = await getRepoName()
      const worktrees = await listWorktrees()
      const mainWorktree = worktrees[0]
      const worktreesDir = join(dirname(mainWorktree.path), `${repoName}-worktrees`)
      const filteredWorktrees = worktrees.filter((wt) => wt.path.includes(worktreesDir))

      if (filteredWorktrees.length === 0) {
        results.push({ status: 'info', label: 'Worktrees', detail: 'no worktrees yet' })
      } else {
        results.push({
          status: 'pass',
          label: 'Worktrees',
          detail: `${filteredWorktrees.length} worktrees in ${worktreesDir}`,
        })
      }
    } catch {
      results.push({ status: 'info', label: 'Worktrees', detail: 'could not check' })
    }

    // Check 6: Config file
    try {
      const worktrees = await listWorktrees()
      const mainWorktreePath = worktrees[0]?.path
      if (mainWorktreePath) {
        const { source } = await loadConfig(mainWorktreePath)
        if (source === 'file') {
          results.push({ status: 'pass', label: 'Config', detail: '.wtrc.js found' })
        } else {
          results.push({ status: 'info', label: 'Config', detail: 'using defaults (no .wtrc.js)' })
        }
      } else {
        results.push({ status: 'info', label: 'Config', detail: 'using defaults (no .wtrc.js)' })
      }
    } catch {
      results.push({ status: 'info', label: 'Config', detail: 'using defaults (no .wtrc.js)' })
    }

    // Print results
    const statusSymbols = {
      pass: pc.green('✓'),
      warn: pc.yellow('⚠'),
      info: pc.blue('○'),
      fail: pc.red('✗'),
    }

    for (const result of results) {
      const symbol = statusSymbols[result.status]
      const detail = result.detail ? `: ${result.detail}` : ''
      console.log(`  ${symbol} ${result.label}${detail}`)
    }

    console.log()

    const hasFail = results.some((r) => r.status === 'fail')
    const hasWarn = results.some((r) => r.status === 'warn')

    if (hasFail) {
      console.log(pc.red('Some checks failed.'))
    } else if (hasWarn) {
      console.log(pc.yellow('All checks passed with warnings.'))
    } else {
      console.log(pc.green('All checks passed!'))
    }
  })

  return cmd
}
