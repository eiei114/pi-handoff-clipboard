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

test("extractObservedPathsFromToolResult scans CRLF grep output without splitting lines", () => {
  const result = extractObservedPathsFromToolResult(
    "grep",
    {},
    [{ type: "text", text: "src/a.ts:1: match\r\nsrc/b.ts:2: match" }],
    "C:/repo",
  );

  assert.deepEqual(result, ["src/a.ts", "src/b.ts"]);
});

test("extractObservedPathsFromToolResult handles large grep output efficiently", () => {
  const text = Array.from({ length: 10_000 }, (_, index) => `src/file-${index % 25}.ts:${index + 1}: match`).join(
    "\n",
  );

  const started = performance.now();
  const result = extractObservedPathsFromToolResult("grep", {}, [{ type: "text", text }], "C:/repo");
  const elapsedMs = performance.now() - started;

  assert.equal(result.length, 25);
  assert.ok(elapsedMs < 50, `expected large grep scan under 50ms, got ${elapsedMs.toFixed(2)}ms`);
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

test("collectObservedFiles recovers and normalizes legacy custom-entry paths", () => {
  const result = collectObservedFiles(
    [
      {
        type: "custom",
        id: "legacy-observed-files",
        parentId: null,
        timestamp: "2026-06-09T00:00:00.000Z",
        customType: OBSERVED_FILES_ENTRY_TYPE,
        data: {
          toolName: "read",
          paths: [
            "@./src/../src/index.ts",
            "src/index.ts",
            "https://example.test/file.ts",
            "plain-text",
            "malformed\nsrc/ignored.ts",
          ],
        },
      },
    ],
    "C:/repo",
  );

  assert.deepEqual(result, ["src/index.ts"]);
});

test("collectObservedFiles ignores malformed custom-entry data without throwing", () => {
  const malformedData = [
    null,
    "not-an-object",
    42,
    ["src/file.ts"],
    { paths: null },
    { paths: [null, 42, { path: "src/file.ts" }, "https://example.test/file.ts", "plain-text"] },
  ];
  const branch = malformedData.map((data, index) => ({
    type: "custom",
    id: `malformed-${index}`,
    parentId: null,
    timestamp: "2026-06-09T00:00:00.000Z",
    customType: OBSERVED_FILES_ENTRY_TYPE,
    data,
  }));

  assert.doesNotThrow(() => collectObservedFiles(branch, "C:/repo"));
  assert.deepEqual(collectObservedFiles(branch, "C:/repo"), []);
});

test("collectObservedFiles recovers paths from a compacted branch with only tool results", () => {
  const branch = [
    {
      type: "message",
      id: "read-result",
      parentId: null,
      timestamp: "2026-06-09T00:00:00.000Z",
      message: {
        role: "toolResult",
        toolName: "read",
        details: { path: "@./src/../src/index.ts" },
        content: [{ type: "text", text: "src/index.ts:4: existing content" }],
        timestamp: 1,
      },
    },
    {
      type: "message",
      id: "grep-result",
      parentId: "read-result",
      timestamp: "2026-06-09T00:00:01.000Z",
      message: {
        role: "toolResult",
        toolName: "grep",
        details: { matches: [{ path: "./docs/guide.md" }] },
        content: [{ type: "text", text: "docs/guide.md:12: matching line" }],
        timestamp: 2,
      },
    },
  ];

  assert.ok(branch.every((entry) => entry.type === "message" && entry.message.role === "toolResult"));
  assert.deepEqual(collectObservedFiles(branch, "C:/repo"), ["src/index.ts", "docs/guide.md"]);
});
