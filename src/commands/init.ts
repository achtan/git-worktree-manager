/**
 * init - Initialize .wtrc.js in current repository
 */

import { join } from 'node:path'
import { Command } from 'commander'
import pc from 'picocolors'
import { getMainWorktreePath } from '../utils/git.js'

const DEFAULT_CONFIG = `export default {
  worktreePath: '$REPO-worktrees/$DIR',
  copy: [],
  symlink: [],
  postCreate: [],
}
`

export function initCommand() {
  const cmd = new Command('init')

  cmd.description('Initialize .wtrc.js configuration in current repository').action(async () => {
    try {
      const mainPath = await getMainWorktreePath()
      const configPath = join(mainPath, '.wtrc.js')

      const file = Bun.file(configPath)
      if (await file.exists()) {
        console.log(pc.yellow(`Config already exists: ${configPath}`))
        console.log(pc.gray('Run `wt config` to view current configuration'))
        return
      }

      await Bun.write(configPath, DEFAULT_CONFIG)

      console.log(pc.green(`Created: ${configPath}`))
      console.log(pc.gray('Run `wt config` to view configuration'))
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
