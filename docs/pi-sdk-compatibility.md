## Pi SDK 1.2.0 compatibility

Development and test dependencies pin the frozen SDK wave exactly:

- `@earendil-works/pi-agent-core`: `1.2.0`
- `@earendil-works/pi-ai`: `1.2.0`
- `@earendil-works/pi-coding-agent`: `1.2.0`
- `@earendil-works/pi-tui`: `1.2.0`

The public peer dependency ranges remain `*`. This extension uses `input`,
`tool_call`, and `tool_result` lifecycle events, `registerCommand`, the Pi AI
`complete` API, and the coding-agent clipboard/TUI helpers. TypeScript checking
and the actual Pi process smoke exercise those APIs on the frozen versions.

The verified [Pi v1.2.0 release notes](https://github.com/earendil-works/pi/releases/tag/v1.2.0)
change `before_agent_start` event payloads to a `messageType` union and note the
startup busy state for `ctx.isIdle()` / `sendUserMessage()`. This package does
not subscribe to `before_agent_start` or call either startup API, so no
speculative API replacement is needed. No deprecated API used by this extension
was identified in the v1.2.0 notes.

### Functional smoke

`npm run ci` executes `npm run smoke:pi` against the actual locally installed
Pi 1.2.0 CLI and this repository's extension. The harness uses an isolated
`PI_CODING_AGENT_DIR` and a deterministic loopback OpenAI-compatible stream; it
makes no external or paid model requests. It checks extension registration,
`/handoff:copy` success and the handled empty-session error path, a second real
Pi process's registration/feature response/shutdown, and native shell startup.
The Windows smoke verifies the generated clipboard content and restores the
previous plain-text clipboard state; Linux headless runs assert the actual OSC 52
payload. The Linux child clears inherited display/Termux variables so CI runners
with a display variable still exercise that deterministic headless path; the
host environment is not modified. Non-text Windows clipboard formats are never
overwritten.

Normal smoke runs do not modify the tracked report. After a successful run,
explicitly record its output with:

```sh
npm run smoke:pi -- --record
```

The committed evidence at `docs/verification/pi-sdk-smoke.json` uses
`pi-sdk-behavior-v2`. Parser regressions require the actual reload-process
feature response and intentionally reject missing responses; they supplement,
not replace, execution of the real Pi host.
