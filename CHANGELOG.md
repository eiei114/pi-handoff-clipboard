# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning.

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
