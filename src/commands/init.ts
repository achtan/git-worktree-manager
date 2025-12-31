import { Command } from 'commander'

const SHELL_FUNCTION = `wtl() {
  wt new "$@" && cd "$(pbpaste)" && webstorm . && claude
}`

export function initCommand() {
  return new Command('init')
    .description('Output shell function for ~/.zshrc')
    .action(() => {
      console.log(SHELL_FUNCTION)
    })
}
