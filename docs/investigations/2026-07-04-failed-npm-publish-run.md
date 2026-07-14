# Investigation: failed npm publish run (2026-07-04)

## Summary

| Field | Value |
| --- | --- |
| Failed run | [28704536299](https://github.com/eiei114/pi-handoff-clipboard/actions/runs/28704536299) |
| Workflow | `Publish to npm` (GitHub Actions: `.github/workflows/publish.yml`) |
| Trigger | `workflow_dispatch` |
| Ref / branch | `v0.1.3` (`a73cf5f`) |
| Package version | `pi-handoff-clipboard@0.1.3` |
| Failure step | `Publish to npm` |
| Classification | **duplicate-version** (concurrent publish race; trigger/configuration) |

The package **is published** on npm. The failed run is a redundant second publish attempt, not an authentication or Trusted Publishing failure.

## Incident timeline (UTC)

Merge commit `a73cf5f` (`chore: add sponsor funding links and bump patch version`) landed on `main` at `2026-07-04T11:18:51Z`.

| Time | Run | Event | Result |
| --- | --- | --- | --- |
| 11:18:51 | [28704533617](https://github.com/eiei114/pi-handoff-clipboard/actions/runs/28704533617) | `push` → Auto Release | success — created tag `v0.1.3`, dispatched `publish.yml` |
| 11:18:51 | [28704533605](https://github.com/eiei114/pi-handoff-clipboard/actions/runs/28704533605) | `push` → Publish to npm (`main`) | success — published `0.1.3` |
| 11:18:59 | [28704536299](https://github.com/eiei114/pi-handoff-clipboard/actions/runs/28704536299) | `workflow_dispatch` → Publish to npm (`v0.1.3`) | **failure** — duplicate version |

npm registry timestamp for `0.1.3`: `2026-07-04T11:19:22.066Z` (matches the successful push-triggered publish run).

## npm public state (checked 2026-07-14)

```text
$ npm view pi-handoff-clipboard versions --json
["0.1.0","0.1.1","0.1.2","0.1.3"]

$ npm view pi-handoff-clipboard@0.1.3 version
0.1.3
```

`0.1.3` is live on the public registry. No corrective publish is required for consumers.

## Failure output (run 28704536299)

The skip step decided to publish because `npm view pi-handoff-clipboard@0.1.3` returned `E404` at `11:19:30Z`:

```text
Publishing pi-handoff-clipboard@0.1.3.
npm publish --access public
npm error code E403
npm error 403 403 Forbidden - PUT https://registry.npmjs.org/pi-handoff-clipboard \
  You cannot publish over the previously published versions: 0.1.3.
```

Trusted Publishing itself worked: provenance was generated before npm rejected the duplicate version.

## Root cause

**Duplicate-version race from overlapping publish triggers.**

On a `package.json` version bump merged to `main`, two independent `publish.yml` runs started within seconds:

1. **Direct push trigger** — `publish.yml` listens for `push` to `main` when `package.json` changes.
2. **Auto-release dispatch** — `auto-release.yml` creates tag `v0.1.3` and runs `gh workflow run publish.yml --ref v0.1.3`.

Concurrency is keyed by git ref (or dispatch input), not package version:

```yaml
concurrency:
  group: npm-publish-${{ github.event.inputs.ref || github.ref }}
```

`auto-release.yml` dispatches with `-f ref="$TAG"` where `TAG` is `v0.1.3`, so the dispatched run uses `github.event.inputs.ref` and lands in group `npm-publish-v0.1.3`. The concurrent push run uses `npm-publish-refs/heads/main`. Those groups do **not** serialize. The push run published first; the dispatched run's pre-publish `npm view` check still saw `E404` (registry propagation / race window) and attempted a second publish, which npm correctly rejected with `E403`.

This is **not** a Trusted Publishing / OIDC authentication failure.

## Current workflow behavior (as of this report)

- `auto-release.yml` — on `main` `package.json` bumps: tag + GitHub Release + explicit `publish.yml` dispatch.
- `publish.yml` — also runs on `push` to `main` (filtered paths), tag `v*.*.*`, `release: published`, and `workflow_dispatch`.
- Skip guard — `npm view name@version`; skip when exit `0`, publish on `E404`, fail on other errors.
- Publish — `npm publish --access public` via Trusted Publishing (`id-token: write`, no `NPM_TOKEN`).

See also `docs/release.md`.

## Reproducible non-publish check

Run from the repository root. This mirrors the workflow skip step without publishing:

```bash
npm run ci

name=$(node -p "require('./package.json').name")
version=$(node -p "require('./package.json').version")
set +e
output=$(npm view "${name}@${version}" version 2>&1)
status=$?
set -e

if [ "$status" -eq 0 ]; then
  echo "SKIP: ${name}@${version} is already on npm (${output})."
elif printf '%s' "$output" | grep -Eq 'E404|404 Not Found'; then
  echo "WOULD_PUBLISH: ${name}@${version} is not on npm yet."
else
  printf '%s\n' "$output" >&2
  exit "$status"
fi
```

Expected when checked on 2026-07-14 (with `package.json` still at version `0.1.3`): `SKIP: pi-handoff-clipboard@0.1.3 is already on npm (0.1.3).`

Optional registry snapshot:

```bash
npm view pi-handoff-clipboard versions --json
npm view pi-handoff-clipboard time --json
```

## Minimal safe correction options

Do **not** apply in this investigation slice. Open a follow-up correction issue if approved.

| Option | Change | Effect |
| --- | --- | --- |
| A (smallest) | Remove the `push` → `main` trigger from `publish.yml`; keep auto-release dispatch + tag/release/manual paths | Eliminates the duplicate path that won the race on 2026-07-04 |
| B | Keep the existing ref-based key (`npm-publish-${{ github.event.inputs.ref || github.ref }}`) and add a `version` workflow input used in `concurrency.group` (e.g. `npm-publish-${{ inputs.version }}`) so all entry points for the same release share one group | Serializes publish attempts for the same version when callers pass the same version input |
| C | Harden skip step with short retry/backoff before treating `E404` as “not published” | Reduces false negatives when a sibling job just published |
| D (process) | Document: after a version-bump merge, do not manually `workflow_dispatch` publish for the same tag | Prevents maintainer-triggered duplicates; does not fix automatic double trigger |

**Recommendation:** Option **A** aligns with `docs/release.md` (auto-release explicitly dispatches publish) and is the smallest structural fix. Option **B** is a good complement if multiple entry points must remain.

## Evidence links

- Failed run: https://github.com/eiei114/pi-handoff-clipboard/actions/runs/28704536299
- Successful concurrent run: https://github.com/eiei114/pi-handoff-clipboard/actions/runs/28704533605
- Auto-release run: https://github.com/eiei114/pi-handoff-clipboard/actions/runs/28704533617
- Merge commit: https://github.com/eiei114/pi-handoff-clipboard/commit/a73cf5f23d85574a0442443dcf0b988c74e1b2ca
