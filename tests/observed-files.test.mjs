import assert from "node:assert/strict";
import test from "node:test";

const {
  collectObservedFiles,
  extractObservedPathsFromToolCall,
  extractObservedPathsFromToolResult,
  OBSERVED_FILES_ENTRY_TYPE,
} = await import("../lib/observed-files.ts");

test("extractObservedPathsFromToolCall captures direct file paths", () => {
  const result = extractObservedPathsFromToolCall("read", { path: "src/index.ts" }, "C:/repo");
  assert.deepEqual(result, ["src/index.ts"]);
});

test("extractObservedPathsFromToolResult recovers file matches from details and text", () => {
  const result = extractObservedPathsFromToolResult(
    "grep",
    { matches: [{ path: "src/lib/file.ts" }] },
    [{ type: "text", text: "src/lib/other.ts:14: match" }],
    "C:/repo",
  );

  assert.deepEqual(result, ["src/lib/file.ts", "src/lib/other.ts"]);
});

test("collectObservedFiles returns empty list when no tracked evidence exists", () => {
  const result = collectObservedFiles(
    [
      {
        type: "message",
        id: "1",
        parentId: null,
        timestamp: "2026-06-09T00:00:00.000Z",
        message: {
          role: "toolResult",
          toolName: "bash",
          content: [{ type: "text", text: "src/index.ts:1: output" }],
          timestamp: 1,
        },
      },
    ],
    "C:/repo",
  );

  assert.deepEqual(result, []);
});

test("collectObservedFiles deduplicates recorded entries", () => {
  const result = collectObservedFiles(
    [
      {
        type: "custom",
        id: "1",
        parentId: null,
        timestamp: "2026-06-09T00:00:00.000Z",
        customType: OBSERVED_FILES_ENTRY_TYPE,
        data: { paths: ["src/index.ts", "src/index.ts"] },
      },
    ],
    "C:/repo",
  );

  assert.deepEqual(result, ["src/index.ts"]);
});
