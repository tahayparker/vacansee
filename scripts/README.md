# Vercel Build Skip Scripts

This directory contains scripts that allow you to skip Vercel deployments based on commit messages.

## How it works

When you push a commit to your repository, Vercel will run the ignore command specified in `vercel.json` before starting the build process. If the script exits with code `0`, the build is skipped. If it exits with code `1`, the build proceeds.

## Skip Patterns

The following patterns in your commit message will skip the build:

- `[skip ci]` - Common CI skip pattern
- `skip deploy` - Custom deploy skip pattern

**Note:** The pattern matching is case-insensitive.

## Usage Examples

```bash
# These commits will skip the Vercel build:
git commit -m "Update README [skip ci]"
git commit -m "Fix typo skip deploy"
git commit -m "Minor changes [SKIP CI]"

# These commits will trigger a normal build:
git commit -m "Add new feature"
git commit -m "Fix critical bug"
```

## Scripts

### `ignore-build-step.js`

- Node.js version (default)
- Uses `git log` to get the latest commit message
- Configured in `vercel.json`

### `ignore-build-step.ps1`

- PowerShell version (alternative for Windows)
- Can be used by updating `vercel.json` to: `"ignoreCommand": "pwsh scripts/ignore-build-step.ps1"`

## Configuration

The ignore command is configured in the root `vercel.json` file:

```json
{
  "ignoreCommand": "node scripts/ignore-build-step.js"
}
```

## Testing Locally

You can test the script locally by running:

```bash
# Test Node.js version
node scripts/ignore-build-step.js

# Test PowerShell version (Windows)
pwsh scripts/ignore-build-step.ps1
```

The script will output the commit message and whether the build should be skipped or not.
