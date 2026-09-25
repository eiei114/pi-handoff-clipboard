# Architecture

This document describes the data flow behind `/handoff:copy`.

## End-to-end flow

1. The command handler in `lib/handoff-copy-command.ts` reads the current session branch with `ctx.sessionManager.getBranch()`.
2. `getHandoffMessages(branch)` from `lib/session-context.ts` converts the branch into conversation messages. It keeps the latest compaction summary and the entries retained after compaction, so the handoff represents the current context. The messages are converted with `convertToLlm` and serialized with `serializeConversation`.
3. The same branch supplies the session metadata used to enrich the prompt:
   - `collectObservedFiles(branch, ctx.cwd)` gathers files observed by tracked tools.
   - `collectUsedSkills(branch)` gathers explicitly invoked skills.
4. The extension's `generatePrompt` function in `extensions/index.ts` sends the serialized conversation, observed files, and suggested skills to `buildGenerationMessage` and the handoff model. The result is normalized by `normalizeGeneratedPrompt`.
5. If generation is not cancelled, `copyToClipboard(prompt)` copies the generated handoff prompt to the clipboard. The command then notifies the user of success or failure.

## Observed-file tracking and recovery

`extensions/index.ts` listens for both `tool_call` and `tool_result` events. When a tracked event yields paths, it appends a custom session entry with:

```ts
OBSERVED_FILES_ENTRY_TYPE // "pi-handoff-clipboard:observed-files"
{ toolName, paths }
```

`collectObservedFiles` reads these custom entries first. This is the primary record and also provides recovery for sessions recorded by the extension before compaction. For older or compacted branches where the custom entry is unavailable, it scans `toolResult` messages and recovers paths from their `details` and text content.

The tracked tool names are defined by `TRACKED_TOOL_NAMES` in `lib/observed-files.ts`:

- `read`
- `write`
- `edit`
- `grep`
- `find_files`
- `fff_multi_grep`

Paths are normalized relative to `ctx.cwd`, deduplicated, and treated as authoritative input to prompt generation; the model must not invent additional files.

## Skill tracking

On `input`, the extension uses `parseSkillCommand` to recognize explicit skill invocations and appends `SKILL_USAGE_ENTRY_TYPE` entries. `collectUsedSkills` reads those entries (and compatible user messages), deduplicates the names, and passes them to `generatePrompt`. The generated prompt omits `## Suggested skills` when the list is empty.
