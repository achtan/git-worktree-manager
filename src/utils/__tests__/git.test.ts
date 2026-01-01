import { describe, expect, test, mock, beforeEach } from 'bun:test'

// Create a mock function we can control
const mockExeca = mock(() => Promise.resolve({ stdout: '' }))

// Mock execa before importing git.ts
mock.module('execa', () => ({
  execa: mockExeca,
}))

const { isPathInWorktree, listWorktrees } = await import('../git.js')

describe('isPathInWorktree', () => {
  test('returns true when path is inside worktree', () => {
    expect(isPathInWorktree('/home/user/project/src/file.ts', '/home/user/project')).toBe(true)
  })

  test('returns true when path equals worktree', () => {
    expect(isPathInWorktree('/home/user/project', '/home/user/project')).toBe(true)
  })

  test('returns false when path is outside worktree', () => {
    expect(isPathInWorktree('/home/user/other', '/home/user/project')).toBe(false)
  })

  test('returns true for partial prefix match (known limitation)', () => {
    // NOTE: This is a known limitation of the current implementation
    // which uses simple startsWith. A proper fix would check for path separator.
    expect(isPathInWorktree('/home/user/project2/src', '/home/user/project')).toBe(true)
  })
})

describe('listWorktrees', () => {
  beforeEach(() => {
    mockExeca.mockReset()
  })

  test('parses single worktree output', async () => {
    mockExeca.mockImplementation(() =>
      Promise.resolve({
        stdout: `worktree /home/user/project
HEAD abc123def456
branch refs/heads/main
`,
      })
    )

    const worktrees = await listWorktrees()

    expect(worktrees).toHaveLength(1)
    expect(worktrees[0]).toEqual({
      path: '/home/user/project',
      commit: 'abc123def456',
      branch: 'main',
      isMain: true,
    })
  })

  test('parses multiple worktrees', async () => {
    mockExeca.mockImplementation(() =>
      Promise.resolve({
        stdout: `worktree /home/user/project
HEAD abc123def456
branch refs/heads/main

worktree /home/user/project-worktrees/feature-auth
HEAD def789ghi012
branch refs/heads/feature/auth
`,
      })
    )

    const worktrees = await listWorktrees()

    expect(worktrees).toHaveLength(2)
    expect(worktrees[0].path).toBe('/home/user/project')
    expect(worktrees[0].branch).toBe('main')
    expect(worktrees[0].isMain).toBe(true)
    expect(worktrees[1].path).toBe('/home/user/project-worktrees/feature-auth')
    expect(worktrees[1].branch).toBe('feature/auth')
    expect(worktrees[1].isMain).toBe(false)
  })

  test('first worktree is marked as main', async () => {
    mockExeca.mockImplementation(() =>
      Promise.resolve({
        stdout: `worktree /home/user/project
HEAD abc123
branch refs/heads/develop

worktree /home/user/project-worktrees/feat
HEAD def456
branch refs/heads/feature
`,
      })
    )

    const worktrees = await listWorktrees()

    expect(worktrees[0].isMain).toBe(true)
    expect(worktrees[1].isMain).toBe(false)
  })
})
