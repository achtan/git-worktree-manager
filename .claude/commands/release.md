# Release

Create a new release for the project.

## Arguments

- `$ARGUMENTS` - Version bump type: `patch` (default), `minor`, or `major`

## Steps

1. **Determine version bump type** from arguments (default: `patch`)

2. **Get current version** from package.json

3. **Calculate new version**:
   - patch: 1.7.1 → 1.7.2
   - minor: 1.7.1 → 1.8.0
   - major: 1.7.1 → 2.0.0

4. **Show version change and ask for confirmation**:
   - Display: "Release: X.Y.Z → A.B.C"
   - Use AskUserQuestion to confirm before proceeding
   - STOP and wait for user confirmation

5. **Update version** in package.json

6. **Build**: Run `bun run build`

7. **Commit**: `git add package.json && git commit -m "Bump version to X.Y.Z"`

8. **Tag**: `git tag vX.Y.Z`

9. **Push**: `git push && git push --tags`

10. **Create GitHub release**: `gh release create vX.Y.Z --title "vX.Y.Z" --generate-notes`
