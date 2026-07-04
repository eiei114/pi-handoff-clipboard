# Pi Handoff Clipboard

[![CI](https://github.com/eiei114/pi-handoff-clipboard/actions/workflows/ci.yml/badge.svg)](https://github.com/eiei114/pi-handoff-clipboard/actions/workflows/ci.yml)
[![Publish](https://github.com/eiei114/pi-handoff-clipboard/actions/workflows/publish.yml/badge.svg)](https://github.com/eiei114/pi-handoff-clipboard/actions/workflows/publish.yml)
[![npm version](https://img.shields.io/npm/v/pi-handoff-clipboard.svg)](https://www.npmjs.com/package/pi-handoff-clipboard)
[![npm downloads](https://img.shields.io/npm/dm/pi-handoff-clipboard.svg)](https://www.npmjs.com/package/pi-handoff-clipboard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Pi package](https://img.shields.io/badge/pi-package-purple.svg)](https://pi.dev/packages)
[![Trusted Publishing](https://img.shields.io/badge/npm-Trusted%20Publishing-blue.svg)](docs/release.md)
<a href="https://buymeacoffee.com/ekawano114m"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="217" height="60"></a>

> Clipboard-first Pi extension that generates a next-session handoff prompt from the current conversation.

## What this is

`pi-handoff-clipboard` is a command-first Pi extension for fast context handoff.
It reads the current branch context, formats a hybrid handoff prompt, and copies it straight to the clipboard.

Use it when you want to split work into a fresh Pi session without saving a markdown handoff note first.

## Features

- `/handoff:copy` writes a handoff summary immediately with no extra goal prompt
- Clipboard-first delivery with no markdown artifact or auto-created session
- Hybrid handoff prompt structure covering context, files involved, task, and suggested skills
- Observed file tracking from real session tool usage rather than guessed file names
- Suggested skills limited to skills explicitly used in the session

## Command

```txt
/handoff:copy
```

Flow:

1. Read the current branch conversation with compaction awareness
2. Reuse the active model to generate a self-contained handoff prompt
3. Copy the result to the clipboard
4. Notify success or failure

## Install

Install the published npm package with Pi:

```bash
pi install npm:pi-handoff-clipboard
```

For a scoped npm package, keep the `npm:` prefix:

```bash
pi install npm:@your-scope/your-pi-package
```

Pin a specific version when you want reproducible installs:

```bash
pi install npm:pi-handoff-clipboard@0.1.1
```

Install into the current project instead of your user Pi settings:

```bash
pi install npm:pi-handoff-clipboard -l
```

Or install from GitHub:

```bash
pi install git:github.com/eiei114/pi-handoff-clipboard
```

Try it without permanently installing:

```bash
pi -e npm:pi-handoff-clipboard
```

## Quick start

Local dev:

```bash
pi -e .
```

Then run:

```txt
/handoff:copy
```

Pi immediately puts a prompt like this onto your clipboard:

```md
## Context
...

## Files involved
- src/...

## Task
...

## Suggested skills
- some-skill
```

## How file and skill tracking works

- `Files involved` comes from observed session tool usage and recovered tool-result metadata
- `Suggested skills` only includes skills explicitly invoked in the session
- If no observed files were captured, the prompt says so instead of inventing paths
- If no skills were used, the `Suggested skills` section is omitted

## Package contents

| Path | Purpose |
|---|---|
| `extensions/` | Pi extension entrypoint |
| `lib/` | Session context, observed-file tracking, skill tracking, and prompt formatting helpers |
| `docs/release.md` | Release and publish notes |

## Development

```bash
npm install
npm run ci
```

Main checks:

- `npm run typecheck`
- `npm test`
- `npm pack --dry-run`

## Release

Preferred path: GitHub Actions Trusted Publishing.

```bash
npm version patch
git push
```

Maintainer fallback when doing a direct manual publish:

```bash
npm publish --access public --otp=123456
```

See [`docs/release.md`](docs/release.md) for the release checklist and Trusted Publishing notes.

## Limitations

- Clipboard copy failure does not fall back to a file or editor preview in v1
- File tracking is best-effort and only uses observed session data
- Skills are suggested only when explicitly invoked in the session

## Security

Pi packages can execute code with your local permissions. Review extensions before installing third-party packages.

- `/handoff:copy` reads current session context and writes to your local clipboard
- Review generated prompts before pasting them into another session when context is sensitive

For vulnerability reporting, see [`SECURITY.md`](SECURITY.md).

## Links

- npm: https://www.npmjs.com/package/pi-handoff-clipboard
- GitHub: https://github.com/eiei114/pi-handoff-clipboard
- Issues: https://github.com/eiei114/pi-handoff-clipboard/issues

## License

MIT
