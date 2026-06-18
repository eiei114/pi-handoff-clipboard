# ROADMAP

## v1 (shipped)

Status: **implemented**

`/handoff:copy` is the only canonical v1 surface. It reads the current branch conversation, generates a hybrid handoff prompt, and copies it directly to the clipboard.

### What v1 includes

- command-first `/handoff:copy` only (no AI-callable tools)
- clipboard-first delivery with success/error notify only
- hybrid handoff prompt sections: `Context`, `Files involved`, `Task`, and optional `Suggested skills`
- observed files from tracked session tool usage (`read`, `write`, `edit`, `grep`, `find_files`, `fff_multi_grep`)
- suggested skills limited to skills explicitly invoked in the session
- task inferred from unresolved conversation context (no separate goal prompt in v1)

### What v1 does not include

- markdown export or temp-file fallback when clipboard copy fails
- editor preview or auto-created session artifacts
- new-session automation
- AI-callable handoff tools

## Next

Status: **not planned in v1**

Possible future slices (not committed):

- richer observed-file recovery for sessions started before the extension was installed
- optional markdown export behind an explicit non-default command
- new-session handoff automation

Maintenance for v1 should keep docs, tests, and package behavior aligned with the shipped clipboard-first flow above.
