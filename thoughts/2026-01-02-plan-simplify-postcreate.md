# Simplify postCreate to string

## Overview

Change `postCreate` from `string[]` to `string`. Remove detached `&` command support.

## Changes Required

### 1. `src/utils/config.ts`

**Schema (line 44):**
```ts
// Before
postCreate: z.array(z.string()).optional(),

// After
postCreate: z.string().optional(),
```

**Interface (line 54):**
```ts
// Before
postCreate: string[]

// After
postCreate: string
```

**Defaults (line 75):**
```ts
// Before
postCreate: [],

// After
postCreate: '',
```

**resolveConfig (line 178):**
```ts
// Before
postCreate: config.postCreate.map((cmd) => resolveTemplate(cmd, vars)),

// After
postCreate: resolveTemplate(config.postCreate, vars),
```

**RunPostCreateCommandsOptions (line 259):**
```ts
// Before
commands: string[]

// After
command: string
```

**runPostCreateCommands (line 268-309):**
Replace entire function - remove loop, remove detached `&` logic, single `sh -c` execution:
```ts
export async function runPostCreateCommand(options: {
  worktreePath: string
  command: string
}): Promise<{ success: boolean; error?: string }> {
  const { worktreePath, command } = options

  const proc = Bun.spawn(['sh', '-c', command], {
    cwd: worktreePath,
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  })

  const exitCode = await proc.exited
  if (exitCode !== 0) {
    return { success: false, error: `Command exited with code ${exitCode}` }
  }
  return { success: true }
}
```

### 2. `src/commands/new.ts`

**Lines 117-137:** Simplify post-create execution:
```ts
// Before
if (config.postCreate.length > 0) {
  const resolvedCommands = config.postCreate.map((cmd) =>
    resolveTemplate(cmd, templateVars),
  )
  const result = await runPostCreateCommands({
    worktreePath,
    commands: resolvedCommands,
    onCommand: (command) => {
      console.log(pc.blue(`→ ${command}`))
    },
  })
  if (result.failed) {
    console.log(pc.yellow(`⚠ Command failed: ${result.failed.error}`))
  } else if (result.executed.length > 0) {
    console.log(pc.green('✓ Post-create commands completed'))
  }
}

// After
if (config.postCreate) {
  const resolvedCommand = resolveTemplate(config.postCreate, templateVars)
  console.log(pc.blue(`→ ${resolvedCommand}`))
  const result = await runPostCreateCommand({ worktreePath, command: resolvedCommand })
  if (!result.success) {
    console.log(pc.yellow(`⚠ Command failed: ${result.error}`))
  } else {
    console.log(pc.green('✓ Post-create command completed'))
  }
}
```

Update import to use `runPostCreateCommand` instead of `runPostCreateCommands`.

### 3. `src/commands/config.ts`

**Lines 59-65:** Display single command:
```ts
// Before
console.log(pc.bold('postCreate:'))
if (config.postCreate.length > 0) {
  for (const command of config.postCreate) {
    console.log(`  - ${command}`)
  }

// After
console.log(pc.bold('postCreate:'))
if (config.postCreate) {
  console.log(`  ${config.postCreate}`)
```

### 4. `src/commands/init.ts`

**Line 14:** Default template:
```ts
// Before
postCreate: [],

// After
postCreate: '',
```

### 5. `.wtrc.example.js`

**Line 16:**
```js
// Before
postCreate: ['npm install'],

// After
postCreate: 'npm install',
```

### 6. `src/utils/__tests__/config.test.ts`

Update all tests using `postCreate`:
- `getDefaults` test (line 29): expect `postCreate: ''`
- `resolveConfig` tests (lines 88, 99, 110): use `postCreate: ''`
- `resolveConfig` test for postCreate (lines 116-128): single string test
- `loadConfig` tests (lines 148, 158, 184): use string format

### 7. Update docs

- `CLAUDE.md`: Remove mention of detached `&` commands
- `README.md`: Update postCreate examples

## Verification

```bash
bun run typecheck
bun test
bun run build
./dist/cli.js config  # verify display
```
