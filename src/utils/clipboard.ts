import { exec } from 'node:child_process'
import { platform } from 'node:os'

export function copyToClipboard(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    const os = platform()
    let cmd: string

    if (os === 'darwin') {
      cmd = 'pbcopy'
    } else if (os === 'win32') {
      cmd = 'clip'
    } else {
      // Linux - try xclip
      cmd = 'xclip -selection clipboard'
    }

    const proc = exec(cmd)
    proc.stdin?.write(text)
    proc.stdin?.end()
    proc.on('close', (code) => resolve(code === 0))
    proc.on('error', () => resolve(false))
  })
}
