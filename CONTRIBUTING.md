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
| `skills/` | Scaffold sample Agent Skill (`example-skill/`) for local Pi discovery testing |
| `prompts/` | Scaffold sample prompt template (`example.md`) |
| `themes/` | Scaffold sample theme JSON (`example-theme.json`) |

The scaffold sample directories (`skills/`, `prompts/`, `themes/`) are for local development only and are not included in the published npm package.

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