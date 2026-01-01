import { describe, expect, test, mock } from 'bun:test'

// Mock execa before importing github.ts
mock.module('execa', () => ({
  execa: mock(() => Promise.resolve({ stdout: '' })),
}))

const { parseGitHubRepo } = await import('../github.js')

describe('parseGitHubRepo', () => {
  describe('SSH format', () => {
    test('parses SSH URL with .git suffix', () => {
      const result = parseGitHubRepo('git@github.com:owner/repo.git')
      expect(result).toEqual({ owner: 'owner', repo: 'repo' })
    })

    test('parses SSH URL without .git suffix', () => {
      const result = parseGitHubRepo('git@github.com:owner/repo')
      expect(result).toEqual({ owner: 'owner', repo: 'repo' })
    })
  })

  describe('HTTPS format', () => {
    test('parses HTTPS URL with .git suffix', () => {
      const result = parseGitHubRepo('https://github.com/owner/repo.git')
      expect(result).toEqual({ owner: 'owner', repo: 'repo' })
    })

    test('parses HTTPS URL without .git suffix', () => {
      const result = parseGitHubRepo('https://github.com/owner/repo')
      expect(result).toEqual({ owner: 'owner', repo: 'repo' })
    })
  })

  describe('invalid URLs', () => {
    test('returns null for invalid URL', () => {
      expect(parseGitHubRepo('not-a-url')).toBeNull()
    })

    test('returns null for non-GitHub URL', () => {
      expect(parseGitHubRepo('https://gitlab.com/owner/repo')).toBeNull()
    })

    test('returns null for empty string', () => {
      expect(parseGitHubRepo('')).toBeNull()
    })
  })
})
