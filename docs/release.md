# Release and publication hold

**Status: HELD.** Automated GitHub release/tag/npm publication and direct manual
publication are unavailable until a separate owner-authorized setup establishes
the required protected release boundary. No protected GitHub Environment or
branch protection was verified for this repository, so this repository does not
claim that a publication path is operational.

The former workflow entrypoints are retained for history under
`.github/disabled-workflows/`; they are not active GitHub Actions workflows.
Only `.github/workflows/` contains executable workflow entrypoints. Current
code and version-bump PRs must pass CI and must not create tags/releases,
dispatch a publish workflow, or publish to npm when merged.

Do not create release tags or GitHub Releases, dispatch workflows, run a local
`npm publish`, or add credentials/settings as a workaround. In particular,
there is no OTP fallback. Package version changes in ordinary PRs prepare source
metadata only; they are not release authorization.

Re-enabling publication requires a separately authorized change that establishes
and verifies the external trust boundary first, followed by independently
reviewed workflow changes and regression tests. Until then, release is blocked
by policy, not by CI.
