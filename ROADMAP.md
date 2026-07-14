# Roadmap

This roadmap tracks the shipped state of `pi-handoff-clipboard`, the maintenance
direction for the next few releases, and a backlog of bounded maintenance
"seeds" (30–90 minute micro-tasks) that the weekly maintenance planner can pick
up. It is a planning surface, not a release commitment: dates and versions here
are targets, and any user-facing change still follows the
[release process](docs/release.md).

## Current release status

| Item | Value |
|---|---|
| npm package | [`pi-handoff-clipboard`](https://www.npmjs.com/package/pi-handoff-clipboard) |
| Latest version | **0.1.3** (GitHub release `v0.1.3`, 2026-07-04) |
| Single command | `/handoff:copy` (clipboard-first) |
| Release mechanism | npm Trusted Publishing via GitHub Actions |
| CI gates | `npm run typecheck`, `node --test tests/*.test.mjs`, `npm pack --dry-run` |

### Recent releases

- **0.1.3** (2026-07-04) — sponsor/funding surface: Buy Me a Coffee button in
  README and native `.github/FUNDING.yml`. No behavior change.
- **0.1.2** (2026-06-18) — hardened `/handoff:copy` v1 flow with explicit
  clipboard-failure handling and regression tests; added this `ROADMAP.md` and
  aligned public docs with the shipped clipboard-first v1 state.
- **0.1.1** (2026-06-09) — `/handoff:copy` writes a clipboard handoff
  immediately without a separate next-session goal prompt; task inference from
  unresolved context.
- **0.1.0** (2026-06-09) — initial `/handoff:copy` scaffold, tracked-session
  observed-file and used-skill tracking, OSS bootstrap.

> See [`CHANGELOG.md`](CHANGELOG.md) for the canonical record. The 0.1.3 sponsor
> entry is currently still under `## Unreleased` there and should be promoted to
> a dated `[0.1.3]` section — see seed [S1](#s1-promote-changelog-to-013).

## Shipped v1 scope

Status: **implemented**

`/handoff:copy` is the only canonical v1 surface. It reads the current branch
conversation, generates a hybrid handoff prompt, and copies it directly to the
clipboard.

### What v1 includes

- command-first `/handoff:copy` only (no AI-callable tools)
- clipboard-first delivery with success/error notify only
- hybrid handoff prompt sections: `Context`, `Files involved`, `Task`, and
  optional `Suggested skills`
- observed files from tracked session tool usage (`read`, `write`, `edit`,
  `grep`, `find_files`, `fff_multi_grep`)
- suggested skills limited to skills explicitly invoked in the session
- task inferred from unresolved conversation context (no separate goal prompt
  in v1)

### What v1 does not include

- markdown export or temp-file fallback when clipboard copy fails
- editor preview or auto-created session artifacts
- new-session automation
- AI-callable handoff tools

## Maintenance direction (next 2–3 releases)

These are planning targets for maintenance releases. v1 behavior stays
clipboard-first; no feature is committed until a maintainer opens it.

- **v0.1.4 — dependency & docs hygiene (maintenance, no behavior change).** Land
  pending Dependabot updates, promote the 0.1.3 changelog entry, and polish dev
  docs. Ships only after `npm run ci` is green and `npm pack --dry-run` is
  unchanged.
- **v0.1.5 — docs & test depth.** Add an architecture/data-flow doc and expand
  regression coverage for observed-file recovery (compacted and pre-install
  sessions). Still no behavior change.
- **v0.2.x — only if a maintainer opens it.** Revisit the clipboard-failure
  fallback and/or optional markdown export listed under [Future directions](#future-directions).
  These intentionally stayed out of v1 and need an explicit decision before any
  work starts.

## Known technical debt & cleanup

Bounded items suitable for 30–90 minute micro-seeds. Each is intentionally small
and does not change shipped behavior unless stated.

- **CHANGELOG lag.** `package.json` is at 0.1.3 but `CHANGELOG.md`'s latest
  dated section is 0.1.2; the 0.1.3 sponsor release sits under `## Unreleased`.
- **Open Dependabot PRs.** Two are currently open against `main`
  (`pi-tui` bump; `npm-dev` minor/patch group). They need triage: validate with
  `npm run ci`, then merge or close with a recorded reason.
- **Thin dev docs.** `docs/` only ships `release.md`; `CONTRIBUTING.md` covers
  the basics but has no project-layout or data-flow explanation.
- **Repo-only scaffold samples.** `prompts/example.md`,
  `skills/example-skill/SKILL.md`, and `themes/example-theme.json` are template
  placeholders not included in the published package (`files` in `package.json`).
  They should either be documented as samples or removed to avoid confusion.
- **Clipboard-failure UX.** v1 has no file/editor fallback on clipboard failure
  (a documented limitation). No code change is planned; a decision record would
  capture the rationale and future options.
- **Observed-file recovery.** Recovery for sessions started before the extension
  was installed is best-effort only; the `OBSERVED_FILES_ENTRY_TYPE` custom-entry
  path is lightly tested.

## Future directions

Status: **not planned in v1**

Possible future slices (not committed):

- richer observed-file recovery for sessions started before the extension was
  installed
- optional markdown export behind an explicit non-default command
- new-session handoff automation
- a clipboard-failure fallback (temp file or editor preview)

Maintenance for v1 should keep docs, tests, and package behavior aligned with the
shipped clipboard-first flow above.

## Maintenance seeds

Candidate micro-tasks for the weekly maintenance planner. Each is scoped to
30–90 minutes with explicit acceptance criteria. Pick one per seed slot; do not
bundle unless the seeds are clearly the same change.

### S1: Promote CHANGELOG to 0.1.3

Move the current `## Unreleased` sponsor/funding entry into a dated
`## [0.1.3] - 2026-07-04` section, and start a fresh empty `## Unreleased`
heading above it.

- **Size:** ~15–30 minutes
- **Scope:** `CHANGELOG.md` only
- **Acceptance criteria**
  - [ ] `## [0.1.3] - 2026-07-04` section exists and matches the shipped
    sponsor/funding change
  - [ ] `## Unreleased` heading remains above it and is empty
  - [ ] `npm run ci` passes
  - [ ] `npm pack --dry-run` file list is unchanged

### S2: Triage open Dependabot PRs

Review each open Dependabot PR against `main` (currently the `pi-tui` bump and
the `npm-dev` minor/patch group). Run `npm run ci` locally for each, then either
merge or close with a one-line rationale in the PR.

- **Size:** ~30–60 minutes
- **Scope:** PRs only (no new code); may require maintainer merge if branch
  protection is on
- **Acceptance criteria**
  - [ ] every open Dependabot PR is either merged green or closed with a reason
  - [ ] if a bump is user-facing (it should not be — these are dev deps), note
    it under `## Unreleased`
  - [ ] no PR is left open without a decision comment

### S3: Expand CONTRIBUTING with project layout & testing

Add a `## Project layout` section mapping `extensions/`, `lib/`, `tests/`,
`docs/`, and the scaffold sample dirs, plus a `## Testing` section pointing at
`node --test tests/*.test.mjs`. Cross-link from the README `Development` section.

- **Size:** ~30–45 minutes
- **Scope:** `CONTRIBUTING.md` + one README link
- **Acceptance criteria**
  - [ ] CONTRIBUTING has `## Project layout` and `## Testing` sections
  - [ ] README `Development` links to CONTRIBUTING
  - [ ] `npm run ci` passes
  - [ ] no published file changes (docs are not in `files`)

### S4: Add architecture / data-flow doc

Add `docs/architecture.md` describing the `/handoff:copy` data flow:
`sessionManager.getBranch()` → `getHandoffMessages` / `collectObservedFiles` /
`collectUsedSkills` → `generatePrompt` → clipboard, including the
`OBSERVED_FILES_ENTRY_TYPE` recovery entry and tracked tool names. Link it from
the README `Package contents` table.

- **Size:** ~45–75 minutes
- **Scope:** new `docs/architecture.md` + README link
- **Acceptance criteria**
  - [ ] `docs/architecture.md` documents the end-to-end flow and the recovery
    entry type
  - [ ] all referenced symbols match current `lib/` source
  - [ ] README `Package contents` links to the new doc
  - [ ] `npm run ci` passes

### S5: Regression tests for observed-file recovery

Add focused tests for `collectObservedFiles` edge cases: a branch containing a
custom `OBSERVED_FILES_ENTRY_TYPE` entry (pre-install recovery path), and a
compacted/older branch where only tool results carry paths. Extend the existing
`tests/observed-files.test.mjs` rather than duplicating it.

- **Size:** ~45–90 minutes
- **Scope:** `tests/observed-files.test.mjs` only
- **Acceptance criteria**
  - [ ] new cases cover the custom-entry recovery branch and a compacted branch
  - [ ] `npm run ci` passes, including the new cases
  - [ ] no changes to `lib/` behavior

### S6 (optional, doc-only): Decision record for clipboard-failure fallback

Add `docs/decisions/clipboard-failure-fallback.md` recording the current "no
fallback in v1" decision, the failure path (`CLIPBOARD_HANDOFF_FAILED_PREFIX`),
and the future options (temp file, editor preview). Link from
[Future directions](#future-directions).

- **Size:** ~30 minutes
- **Scope:** new decision-record file only
- **Acceptance criteria**
  - [ ] decision record states the current behavior and rationale
  - [ ] options list matches the README `Limitations` section
  - [ ] no code or published-file changes
