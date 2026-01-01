/**
 * Exec utilities
 *
 * Helper function for spawning processes using Bun.spawn.
 */

export interface ExecResult {
  stdout: string
}

/**
 * Execute a command and return stdout
 * Throws on non-zero exit code
 */
export async function exec(cmd: string, args: string[]): Promise<ExecResult> {
  const proc = Bun.spawn([cmd, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const exitCode = await proc.exited
  const stdout = await new Response(proc.stdout).text()

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(stderr || `Command failed with exit code ${exitCode}`)
  }

  return { stdout }
}
