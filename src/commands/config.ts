/**
 * config - Display current configuration
 */

import { Command } from 'commander'
import pc from 'picocolors'
import { join } from 'node:path'
import { getMainWorktreePath, getRepoName } from '../utils/git.js'
import { loadConfig } from '../utils/config.js'

export function configCommand() {
  const cmd = new Command('config')

  cmd.description('Display current .wtrc.json configuration').action(async () => {
    try {
      const mainWorktreePath = await getMainWorktreePath()
      const repoName = await getRepoName()
      const configPath = join(mainWorktreePath, '.wtrc.json')
      const { config, source } = await loadConfig(mainWorktreePath)

      // Show config file status
      if (source === 'defaults') {
        console.log(pc.gray('Config: No .wtrc.json found (using defaults)'))
      } else {
        console.log(pc.gray(`Config: ${configPath}`))
      }

      console.log()

      // Display worktreePath with example resolution
      console.log(pc.bold('worktreePath:'), config.worktreePath)
      const exampleDir = config.worktreePath
        .replace(/\$REPO\b/g, repoName)
        .replace(/\$DIR\b/g, '<branch>')
      console.log(pc.gray(`             → ${exampleDir}`))

      // Display copy patterns
      console.log()
      console.log(pc.bold('copy:'))
      if (config.copy.length > 0) {
        for (const pattern of config.copy) {
          console.log(`  - ${pattern}`)
        }
      } else {
        console.log(pc.gray('  (none)'))
      }

      // Display symlink patterns
      console.log()
      console.log(pc.bold('symlink:'))
      if (config.symlink.length > 0) {
        for (const pattern of config.symlink) {
          console.log(`  - ${pattern}`)
        }
      } else {
        console.log(pc.gray('  (none)'))
      }

      // Display postCreate commands
      console.log()
      console.log(pc.bold('postCreate:'))
      if (config.postCreate.length > 0) {
        for (const command of config.postCreate) {
          console.log(`  - ${command}`)
        }
      } else {
        console.log(pc.gray('  (none)'))
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(pc.red(`Error: ${error.message}`))
      } else {
        console.error(pc.red('An unknown error occurred'))
      }
      process.exit(1)
    }
  })

  return cmd
}
