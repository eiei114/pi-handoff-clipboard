# Release

This package uses npm Trusted Publishing with GitHub Actions OIDC.

Do not add `NPM_TOKEN` or long-lived npm tokens to GitHub Secrets.

## One-time npm setup

On npmjs.com, configure Trusted Publishing for this package:

- Publisher: GitHub Actions
- Repository: this GitHub repository
- Workflow filename: `publish.yml`

## Explicit release action

```bash
gh workflow run auto-release.yml --ref main
```

Merging a version bump to `main` does not trigger release or publication. An
authorized maintainer explicitly dispatches `.github/workflows/auto-release.yml`
from `main`; it creates `v<package-version>`, creates the GitHub Release, then
explicitly dispatches `.github/workflows/publish.yml` for that tag.

Both workflows are `workflow_dispatch` only. The publish workflow accepts only
a `v<major>.<minor>.<patch>` tag whose version matches `package.json`; pushing a
tag or publishing a GitHub Release by itself does not publish to npm. An
authorized maintainer may also dispatch `publish.yml` directly for a reviewed
version tag.

The workflow skips `name@version` if that exact package version already exists on npm.

## Manual maintainer publish with OTP

Use this only when you intentionally want a direct local publish instead of the normal GitHub Actions route.

```bash
npm run ci
npm whoami
npm publish --access public --otp=123456
```

Checks before running manual OTP publish:

- `package.json` version is the version you want on npm
- `CHANGELOG.md` is updated
- `npm pack --dry-run` contains only intended files
- npm package access is `public`

## Workflow guardrail

Do not ship a new Pi OSS package or version bump with only `package.json` changes.
Keep the release workflow pair and ensure ordinary merges cannot publish:

- `.github/workflows/auto-release.yml` runs only when explicitly dispatched from `main` and creates `v<version>` tags and GitHub Releases.
- `.github/workflows/publish.yml` runs only when explicitly dispatched and publishes a matching `v<version>` tag through Trusted Publishing.

The `GITHUB_TOKEN` tag/release created by `auto-release.yml` does not need a
tag-push or `release.published` trigger: the workflow explicitly dispatches
`publish.yml` for the tag. Keep that explicit handoff. Do not add push or
release-event triggers to either workflow; a version bump merge must not start
release, tagging, or npm publication automatically.

## GitHub Actions requirements

- `permissions: id-token: write`
- `permissions: actions: write` on auto-release so it can dispatch `publish.yml`
- `auto-release.yml` must call `gh workflow run publish.yml --ref "$TAG" -f ref="$TAG"`
- GitHub-hosted runner
- Node.js 24, so the release job uses a current npm CLI for Trusted Publishing
- No `NPM_TOKEN`
- `npm publish` from the configured workflow file

## First release checklist

- [ ] `package.json` name is final
- [ ] `repository.url` points to the real GitHub repository
- [ ] npm Trusted Publisher is configured
- [ ] `npm run ci` passes
- [ ] `npm pack --dry-run` contains only intended files
- [ ] CHANGELOG.md has the release date
