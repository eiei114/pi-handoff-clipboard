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
