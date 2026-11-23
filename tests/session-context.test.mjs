import assert from "node:assert/strict";
import test from "node:test";

const { getHandoffMessages } = await import("../lib/session-context.ts");

test("getHandoffMessages returns branch messages when there is no compaction", () => {
  const result = getHandoffMessages([
    {
      type: "message",
      id: "1",
      parentId: null,
      timestamp: "2026-06-09T00:00:00.000Z",
      message: { role: "user", content: "hello", timestamp: 1 },
    },
    {
      type: "session_info",
      id: "2",
      parentId: "1",
      timestamp: "2026-06-09T00:00:01.000Z",
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].role, "user");
});

test("getHandoffMessages keeps compaction summary plus kept entries", () => {
  const result = getHandoffMessages([
    {
      type: "message",
      id: "a",
      parentId: null,
      timestamp: "2026-06-09T00:00:00.000Z",
      message: { role: "user", content: "old", timestamp: 1 },
    },
    {
      type: "message",
      id: "b",
      parentId: "a",
      timestamp: "2026-06-09T00:00:01.000Z",
      message: { role: "assistant", content: [{ type: "text", text: "mid" }], timestamp: 2 },
    },
    {
      type: "compaction",
      id: "c",
      parentId: "b",
      timestamp: "2026-06-09T00:00:02.000Z",
      summary: "summary",
      firstKeptEntryId: "b",
      tokensBefore: 100,
    },
    {
      type: "message",
      id: "d",
      parentId: "c",
      timestamp: "2026-06-09T00:00:03.000Z",
      message: { role: "user", content: "new", timestamp: 3 },
    },
  ]);

  assert.equal(result[0].role, "compactionSummary");
  assert.equal(result[1].role, "assistant");
  assert.equal(result[2].role, "user");
});

test("getHandoffMessages keeps only the latest summary and later messages when the retained entry is missing", () => {
  const result = getHandoffMessages([
    {
      type: "message",
      id: "a",
      parentId: null,
      timestamp: "2026-06-09T00:00:00.000Z",
      message: { role: "user", content: "older work", timestamp: 1 },
    },
    {
      type: "compaction",
      id: "b",
      parentId: "a",
      timestamp: "2026-06-09T00:00:01.000Z",
      summary: "older summary",
      firstKeptEntryId: "a",
      tokensBefore: 100,
    },
    {
      type: "message",
      id: "c",
      parentId: "b",
      timestamp: "2026-06-09T00:00:02.000Z",
      message: { role: "user", content: "work before latest compaction", timestamp: 2 },
    },
    {
      type: "compaction",
      id: "d",
      parentId: "c",
      timestamp: "2026-06-09T00:00:03.000Z",
      summary: "latest summary",
      firstKeptEntryId: "missing",
      tokensBefore: 200,
    },
    {
      type: "message",
      id: "e",
      parentId: "d",
      timestamp: "2026-06-09T00:00:04.000Z",
      message: { role: "user", content: "work after latest compaction", timestamp: 3 },
    },
  ]);

  assert.deepEqual(result, [
    {
      role: "compactionSummary",
      summary: "latest summary",
      tokensBefore: 200,
      timestamp: Date.parse("2026-06-09T00:00:03.000Z"),
    },
    { role: "user", content: "work after latest compaction", timestamp: 3 },
  ]);
});
