# Changelog

## Unreleased

## [0.1.6] - 2026-08-22

### Changed

- Merge the 2026-08-22 managed OSS dependency and maintenance PR batch.

## [0.1.5] - 2026-08-04

### Changed

- Add dotfield.xyz Discord community badge to README.
- Align README pinned install example with the released package version.
- Promote the 0.1.3 sponsor changelog entry and keep release docs in sync.
- Bump GitHub Actions `setup-node` to v7 in CI and publish workflows.

## [0.1.4] - 2026-07-21

### Changed

- Align CONTRIBUTING release push steps with the auto-release workflow.
- Add npm publish investigation notes and refresh ROADMAP maintenance direction.

## [0.1.3] - 2026-07-04

### Changed

- Add Buy Me a Coffee sponsor button to README and native GitHub funding link via `.github/FUNDING.yml`.

## [0.1.2] - 2026-06-17

### Changed

- Hardened `/handoff:copy` v1 flow with explicit clipboard-failure handling and regression tests for observed files and used-skill filtering.
- Added `ROADMAP.md` and aligned public docs with the shipped clipboard-first v1 state.

## [0.1.1] - 2026-06-09

### Changed

- `/handoff:copy` now writes a clipboard handoff immediately from the current conversation without asking for a separate next-session goal.
- Handoff prompt generation now infers the next task from unresolved conversation context and stays closer to the existing handoff-summary workflow.

## [0.1.0] - 2026-06-09

### Added

- `/handoff:copy` clipboard-first command scaffold and tracked-session handoff generation modules.
- Session-aware observed file and used-skill tracking for handoff prompt generation.
- Initial OSS bootstrap for `pi-handoff-clipboard`.
