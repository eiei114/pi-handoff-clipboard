# Contributing

Thanks for helping improve this Pi package.

## Development

```bash
npm install
npm run ci
```

## Local Pi testing

```bash
pi -e .
```

## Project layout

| Path | Purpose |
|---|---|
| `extensions/` | Pi extension entrypoint; registers `/handoff:copy` |
| `lib/` | Session context, observed-file tracking, skill tracking, and prompt formatting helpers |
| `tests/` | Regression tests run with Node's built-in test runner (`*.test.mjs`) |
| `docs/` | Maintainer docs (release checklist, investigations) |
| `skills/` | Scaffold sample Agent Skill (see [Scaffold samples](#scaffold-samples)) |
| `prompts/` | Scaffold sample prompt template (see [Scaffold samples](#scaffold-samples)) |
| `themes/` | Scaffold sample theme JSON (see [Scaffold samples](#scaffold-samples)) |

## Scaffold samples

The `prompts/`, `skills/`, and `themes/` directories are local-only Pi discovery samples. They let you exercise Pi package scaffolding with `pi -e .` without publishing, and they are intentionally excluded from the npm tarball (`package.json` `files`).

| Path | Sample file | Purpose |
|---|---|---|
| `prompts/` | `example.md` | Example prompt template for local Pi discovery |
| `skills/` | `example-skill/SKILL.md` | Example Agent Skill for local skill discovery testing |
| `themes/` | `example-theme.json` | Example theme JSON for local theme discovery testing |

Do not expect these directories in a published `npm install`; edit them freely for local development only.

## Testing

Run the full test suite:

```bash
node --test tests/*.test.mjs
```

Or use the npm script (also included in `npm run ci`):

```bash
npm test
```

Test files cover session context, observed files, skill suggestions, prompt formatting, the `/handoff:copy` command flow, and a smoke check.

## Pull requests

Before opening a PR:

- Run `npm run ci`
- Update docs when behavior changes
- Update `CHANGELOG.md` for user-facing changes
- Keep package contents small and intentional

## Release

Releases use npm Trusted Publishing. Do not add `NPM_TOKEN` to GitHub Secrets.

```bash
npm version patch
git push
```

`auto-release.yml` creates the release tag and dispatches `publish.yml` after the version bump lands on `main`. Push the version commit only; see [`docs/release.md`](docs/release.md) for the full release flow.