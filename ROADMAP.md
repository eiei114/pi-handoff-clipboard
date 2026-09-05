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
| Latest version | **0.1.6** (GitHub release `v0.1.6`, 2026-08-22) |
| Single command | `/handoff:copy` (clipboard-first) |
| Release mechanism | npm Trusted Publishing via GitHub Actions |
| CI gates | `npm run typecheck`, `node --test tests/*.test.mjs`, `npm pack --dry-run` |
| Open Dependabot PRs | none |
| Open GitHub issues | none |

### Recent releases

- **0.1.6** (2026-08-22) — merged managed OSS dependency and maintenance PR
  batch (TypeScript 7, `@types/node`, and related dev-dependency updates). No
  behavior change.
- **0.1.5** (2026-08-04) — Discord community badge, README pinned-install
  alignment, promoted 0.1.3 changelog entry, GitHub Actions `setup-node` v7
  bump. No behavior change.
- **0.1.4** (2026-07-21) — CONTRIBUTING release steps aligned with
  auto-release workflow; npm publish investigation notes; ROADMAP maintenance
  direction refresh. No behavior change.
- **0.1.3** (2026-07-04) — sponsor/funding surface: Buy Me a Coffee button in
  README and native `.github/FUNDING.yml`. No behavior change.
- **0.1.2** (2026-06-18) — hardened `/handoff:copy` v1 flow with explicit
  clipboard-failure handling and regression tests; added this `ROADMAP.md` and
  aligned public docs with the shipped clipboard-first v1 state.

> See [`CHANGELOG.md`](CHANGELOG.md) for the canonical record.

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

## Maintenance direction (next 1–2 releases)

These are planning targets for maintenance releases. v1 behavior stays
clipboard-first; no feature is committed until a maintainer opens it.

- **v0.1.7 — docs & test depth (maintenance, no behavior change).** Add an
  architecture/data-flow doc, expand observed-file recovery regression tests,
  and record the clipboard-failure decision. Ships only after `npm run ci` is
  green and `npm pack --dry-run` is unchanged.
- **v0.2.x — only if a maintainer opens it.** Revisit the clipboard-failure
  fallback and/or optional markdown export listed under
  [Future directions](#future-directions). These intentionally stayed out of v1
  and need an explicit decision before any work starts.

## Known technical debt & cleanup

Bounded items suitable for 30–90 minute micro-seeds. Each is intentionally small
and does not change shipped behavior unless stated.

- **Thin dev docs.** `docs/` ships `release.md` and one investigation note;
  there is no architecture or data-flow doc explaining how `/handoff:copy`
  assembles a prompt end-to-end.
- **Observed-file recovery coverage.** The `OBSERVED_FILES_ENTRY_TYPE`
  custom-entry recovery path and compacted-branch tool-result recovery are only
  lightly tested; edge cases for sessions started before the extension was
  installed remain best-effort.
- **Clipboard-failure UX.** v1 has no file/editor fallback on clipboard failure
  (a documented limitation). No code change is planned; a decision record would
  capture the rationale and future options.
- **Repo-only scaffold samples.** `prompts/example.md`,
  `skills/example-skill/SKILL.md`, and `themes/example-theme.json` are template
  placeholders not included in the published package (`files` in `package.json`).
  They should either be documented as samples or removed to avoid confusion.
- **npm audit advisories.** `npm audit` reports moderate/high dev-dependency
  advisories; triage whether Dependabot or a manual bump resolves them without
  changing shipped behavior.

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

### S1: Add architecture / data-flow doc

Add `docs/architecture.md` describing the `/handoff:copy` data flow:
`sessionManager.getBranch()` → `getHandoffMessages` / `collectObservedFiles` /
`collectUsedSkills` → `generatePrompt` → clipboard, including the
`OBSERVED_FILES_ENTRY_TYPE` recovery entry and tracked tool names. Link it from
the README `Package contents` table.

- **Size:** ~45–75 minutes
- **Why needed:** `docs/` only has release notes today; new contributors cannot
  trace how session data becomes a handoff prompt without reading all of `lib/`.
- **Scope:** new `docs/architecture.md` + README link
- **Acceptance criteria**
  - [ ] `docs/architecture.md` documents the end-to-end flow and the recovery
    entry type
  - [ ] all referenced symbols match current `lib/` source
  - [ ] README `Package contents` links to the new doc
  - [ ] `npm run ci` passes

### S2: Regression tests for observed-file recovery

Add focused tests for `collectObservedFiles` edge cases: a branch containing a
custom `OBSERVED_FILES_ENTRY_TYPE` entry (pre-install recovery path), and a
compacted/older branch where only tool results carry paths. Extend the existing
`tests/observed-files.test.mjs` rather than duplicating it.

- **Size:** ~45–90 minutes
- **Why needed:** observed-file recovery is best-effort and the custom-entry
  path is the main safety net for sessions started before the extension was
  installed; regressions here silently degrade handoff quality.
- **Scope:** `tests/observed-files.test.mjs` only
- **Acceptance criteria**
  - [ ] new cases cover the custom-entry recovery branch and a compacted branch
  - [ ] `npm run ci` passes, including the new cases
  - [ ] no changes to `lib/` behavior

### S3: Decision record for clipboard-failure fallback

Add `docs/decisions/clipboard-failure-fallback.md` recording the current "no
fallback in v1" decision, the failure path (`CLIPBOARD_HANDOFF_FAILED_PREFIX`),
and the future options (temp file, editor preview). Link from
[Future directions](#future-directions).

- **Size:** ~30 minutes
- **Why needed:** clipboard failure is a documented limitation but the rationale
  is scattered across README and code; a decision record prevents accidental
  scope creep into v0.2 work without maintainer sign-off.
- **Scope:** new decision-record file only
- **Acceptance criteria**
  - [ ] decision record states the current behavior and rationale
  - [ ] options list matches the README `Limitations` section
  - [ ] no code or published-file changes

### S4: Document scaffold sample directories

Add a short `## Scaffold samples` subsection to `CONTRIBUTING.md` explaining
that `prompts/`, `skills/`, and `themes/` are local-only Pi discovery samples
and are intentionally excluded from the npm tarball. Cross-link from README if
helpful.

- **Size:** ~30 minutes
- **Why needed:** the sample dirs look like shipped package content but are not
  in `package.json` `files`; without a label, contributors may edit or expect
  them in published installs.
- **Scope:** `CONTRIBUTING.md` (+ optional README cross-link)
- **Acceptance criteria**
  - [ ] CONTRIBUTING explains the three scaffold dirs and their local-only status
  - [ ] `npm run ci` passes
  - [ ] no published file changes (docs are not in `files`)

### S5: Triage npm audit dev-dependency advisories

Run `npm audit`, identify whether the reported moderate/high items are
dev-dependency only, and either open a Dependabot-friendly bump PR or document
why a bump is deferred. Validate with `npm run ci` before merge.

- **Size:** ~30–60 minutes
- **Why needed:** audit noise makes real security issues harder to spot; keeping
  dev deps current also reduces CI/toolchain drift after the TypeScript 7 bump.
- **Scope:** dependency updates or a brief note in `docs/investigations/`
- **Acceptance criteria**
  - [ ] each reported advisory is either resolved or documented with a reason
  - [ ] `npm run ci` passes on any bump PR
  - [ ] no user-facing behavior change

## Completed seeds (archive)

These were picked up in prior maintenance cycles and are kept for traceability.

| Seed | Outcome | Reference |
|---|---|---|
| Promote CHANGELOG to 0.1.3 | Done in 0.1.5 | [`CHANGELOG.md`](CHANGELOG.md) |
| Triage open Dependabot PRs | Merged in 0.1.6 batch | PRs #39, #40 |
| Expand CONTRIBUTING layout & testing | Done | PR #42 (DOT-1699) |
| Refresh ROADMAP to current release | Done | DOT-1000 |
