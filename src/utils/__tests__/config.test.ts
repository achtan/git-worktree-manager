import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, writeFile, rm, readFile, lstat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  resolveTemplate,
  resolveConfig,
  getDefaults,
  loadConfig,
  copyConfigFiles,
  ConfigValidationError,
  type TemplateVariables,
} from '../config.js'

const testVars: TemplateVariables = {
  PATH: '/home/user/project-worktrees/feature-auth',
  BRANCH: 'feature/auth',
  DIR: 'feature-auth',
  REPO: 'project',
}

describe('getDefaults', () => {
  test('returns expected structure', () => {
    const defaults = getDefaults()
    expect(defaults).toEqual({
      worktreePath: '$REPO-worktrees/$DIR',
      copy: [],
      symlink: [],
      postCreate: [],
    })
  })

  test('returns new object each time', () => {
    const defaults1 = getDefaults()
    const defaults2 = getDefaults()
    expect(defaults1).not.toBe(defaults2)
  })
})

describe('resolveTemplate', () => {
  test('replaces $PATH variable', () => {
    const result = resolveTemplate('cd $PATH', testVars)
    expect(result).toBe('cd /home/user/project-worktrees/feature-auth')
  })

  test('replaces $BRANCH variable', () => {
    const result = resolveTemplate('git checkout $BRANCH', testVars)
    expect(result).toBe('git checkout feature/auth')
  })

  test('replaces $DIR variable', () => {
    const result = resolveTemplate('mkdir $DIR', testVars)
    expect(result).toBe('mkdir feature-auth')
  })

  test('replaces $REPO variable', () => {
    const result = resolveTemplate('$REPO-worktrees', testVars)
    expect(result).toBe('project-worktrees')
  })

  test('replaces multiple variables', () => {
    const result = resolveTemplate('$REPO-worktrees/$DIR', testVars)
    expect(result).toBe('project-worktrees/feature-auth')
  })

  test('replaces same variable multiple times', () => {
    const result = resolveTemplate('$DIR/$DIR', testVars)
    expect(result).toBe('feature-auth/feature-auth')
  })

  test('leaves string unchanged when no variables', () => {
    const result = resolveTemplate('plain text', testVars)
    expect(result).toBe('plain text')
  })

  test('does not replace partial matches', () => {
    const result = resolveTemplate('$PATHX $DIRX', testVars)
    expect(result).toBe('$PATHX $DIRX')
  })
})

describe('resolveConfig', () => {
  test('transforms worktreePath', () => {
    const config = {
      worktreePath: '$REPO-worktrees/$DIR',
      copy: ['.env'],
      symlink: ['node_modules'],
      postCreate: [],
    }
    const result = resolveConfig(config, testVars)
    expect(result.worktreePath).toBe('project-worktrees/feature-auth')
  })

  test('leaves copy patterns unchanged', () => {
    const config = {
      worktreePath: '$REPO-worktrees/$DIR',
      copy: ['.env', '$PATH/file'],
      symlink: [],
      postCreate: [],
    }
    const result = resolveConfig(config, testVars)
    expect(result.copy).toEqual(['.env', '$PATH/file'])
  })

  test('leaves symlink patterns unchanged', () => {
    const config = {
      worktreePath: '$REPO-worktrees/$DIR',
      copy: [],
      symlink: ['node_modules', '$DIR/stuff'],
      postCreate: [],
    }
    const result = resolveConfig(config, testVars)
    expect(result.symlink).toEqual(['node_modules', '$DIR/stuff'])
  })

  test('transforms postCreate commands', () => {
    const config = {
      worktreePath: '$REPO-worktrees/$DIR',
      copy: [],
      symlink: [],
      postCreate: ['cd $PATH && npm install', 'echo $BRANCH'],
    }
    const result = resolveConfig(config, testVars)
    expect(result.postCreate).toEqual([
      'cd /home/user/project-worktrees/feature-auth && npm install',
      'echo feature/auth',
    ])
  })
})

describe('loadConfig', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `wt-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(tempDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  test('valid config file returns config', async () => {
    const config = {
      worktreePath: '../worktrees/$DIR',
      copy: ['.env'],
      symlink: ['node_modules'],
      postCreate: ['bun install'],
    }
    await writeFile(join(tempDir, '.wtrc.json'), JSON.stringify(config))

    const result = await loadConfig(tempDir)

    expect(result.source).toBe('file')
    expect(result.config.worktreePath).toBe('../worktrees/$DIR')
    expect(result.config.copy).toEqual(['.env'])
    expect(result.config.symlink).toEqual(['node_modules'])
    expect(result.config.postCreate).toEqual(['bun install'])
  })

  test('missing file returns defaults', async () => {
    const result = await loadConfig(tempDir)

    expect(result.source).toBe('defaults')
    expect(result.config).toEqual(getDefaults())
  })

  test('invalid JSON throws ConfigValidationError', async () => {
    await writeFile(join(tempDir, '.wtrc.json'), 'not valid json{')

    expect(loadConfig(tempDir)).rejects.toThrow(ConfigValidationError)
  })

  test('partial config uses defaults for missing fields', async () => {
    const config = { copy: ['.env'] }
    await writeFile(join(tempDir, '.wtrc.json'), JSON.stringify(config))

    const result = await loadConfig(tempDir)

    expect(result.source).toBe('file')
    expect(result.config.copy).toEqual(['.env'])
    expect(result.config.worktreePath).toBe('$REPO-worktrees/$DIR')
    expect(result.config.symlink).toEqual([])
    expect(result.config.postCreate).toEqual([])
  })
})

describe('copyConfigFiles', () => {
  let sourceDir: string
  let targetDir: string

  beforeEach(async () => {
    const base = join(tmpdir(), `wt-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    sourceDir = join(base, 'source')
    targetDir = join(base, 'target')
    await mkdir(sourceDir, { recursive: true })
    await mkdir(targetDir, { recursive: true })
  })

  afterEach(async () => {
    const base = join(sourceDir, '..')
    await rm(base, { recursive: true, force: true })
  })

  test('copies files from source to target', async () => {
    await writeFile(join(sourceDir, '.env'), 'SECRET=123')

    const result = await copyConfigFiles({
      mainWorktreePath: sourceDir,
      worktreePath: targetDir,
      copyPatterns: ['.env'],
      symlinkPatterns: [],
    })

    expect(result.copied).toEqual(['.env'])
    expect(result.warnings).toEqual([])
    const content = await readFile(join(targetDir, '.env'), 'utf-8')
    expect(content).toBe('SECRET=123')
  })

  test('creates symlinks for files', async () => {
    await writeFile(join(sourceDir, '.npmrc'), 'registry=https://npm.example.com')

    const result = await copyConfigFiles({
      mainWorktreePath: sourceDir,
      worktreePath: targetDir,
      copyPatterns: [],
      symlinkPatterns: ['.npmrc'],
    })

    expect(result.symlinked).toEqual(['.npmrc'])
    expect(result.warnings).toEqual([])
    const stat = await lstat(join(targetDir, '.npmrc'))
    expect(stat.isSymbolicLink()).toBe(true)
  })

  test('handles missing source files gracefully', async () => {
    const result = await copyConfigFiles({
      mainWorktreePath: sourceDir,
      worktreePath: targetDir,
      copyPatterns: ['nonexistent.txt'],
      symlinkPatterns: [],
    })

    expect(result.copied).toEqual([])
    expect(result.warnings).toEqual([])
  })

  test('copies nested files preserving structure', async () => {
    await mkdir(join(sourceDir, '.claude'), { recursive: true })
    await writeFile(join(sourceDir, '.claude', 'settings.json'), '{}')

    const result = await copyConfigFiles({
      mainWorktreePath: sourceDir,
      worktreePath: targetDir,
      copyPatterns: ['.claude/settings.json'],
      symlinkPatterns: [],
    })

    expect(result.copied).toEqual(['.claude/settings.json'])
    const content = await readFile(join(targetDir, '.claude', 'settings.json'), 'utf-8')
    expect(content).toBe('{}')
  })
})
