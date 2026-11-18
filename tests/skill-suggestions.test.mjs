import assert from "node:assert/strict";
import test from "node:test";

const { collectUsedSkills, parseSkillCommand, SKILL_USAGE_ENTRY_TYPE } = await import(
  "../lib/skill-suggestions.ts"
);

test("parseSkillCommand reads slash skill invocations", () => {
  assert.equal(parseSkillCommand("/skill:handoff"), "handoff");
  assert.equal(parseSkillCommand("/skill:handoff extra context"), "handoff");
});

test("parseSkillCommand reads skill tags inside surrounding text", () => {
  assert.equal(parseSkillCommand('before <skill name="first-skill"> after'), "first-skill");
  assert.equal(parseSkillCommand("before <skill name='second-skill'> after"), "second-skill");
  assert.equal(parseSkillCommand("before <skill> after"), undefined);
});

test("parseSkillCommand handles slash whitespace and rejects incomplete or similar commands", () => {
  assert.equal(parseSkillCommand("/skill:line-break\nwith extra text"), "line-break");
  assert.equal(parseSkillCommand("  /skill:spaced  \t"), "spaced");
  assert.equal(parseSkillCommand("/skill:"), undefined);
  assert.equal(parseSkillCommand("/skill: name"), undefined);
  assert.equal(parseSkillCommand("/skills:foo"), undefined);
});

test("collectUsedSkills ignores non-skill user messages", () => {
  const result = collectUsedSkills([
    {
      type: "message",
      id: "1",
      parentId: null,
      timestamp: "2026-06-09T00:00:00.000Z",
      message: { role: "user", content: "please refactor src/index.ts", timestamp: 1 },
    },
  ]);

  assert.deepEqual(result, []);
});

test("collectUsedSkills reads text blocks and ignores other blocks and non-user messages", () => {
  const result = collectUsedSkills([
    {
      type: "message",
      id: "1",
      parentId: null,
      timestamp: "2026-06-09T00:00:00.000Z",
      message: {
        role: "user",
        content: [
          { type: "image", data: "ignored", mimeType: "image/png" },
          { type: "text", text: "/skill:from-text-block" },
        ],
        timestamp: 1,
      },
    },
    {
      type: "message",
      id: "2",
      parentId: "1",
      timestamp: "2026-06-09T00:00:01.000Z",
      message: { role: "assistant", content: "/skill:assistant-skill", timestamp: 2 },
    },
    {
      type: "message",
      id: "3",
      parentId: "2",
      timestamp: "2026-06-09T00:00:02.000Z",
      message: {
        role: "toolResult",
        toolName: "bash",
        content: [{ type: "text", text: "/skill:tool-skill" }],
        timestamp: 3,
      },
    },
  ]);

  assert.deepEqual(result, ["from-text-block"]);
});

test("collectUsedSkills trims explicit recorded skill names", () => {
  const result = collectUsedSkills([
    {
      type: "custom",
      id: "1",
      parentId: null,
      timestamp: "2026-06-09T00:00:00.000Z",
      customType: SKILL_USAGE_ENTRY_TYPE,
      data: { skillName: "  pi-oss-bootstrap  " },
    },
  ]);

  assert.deepEqual(result, ["pi-oss-bootstrap"]);
});

test("collectUsedSkills prefers explicit recorded skills and deduplicates", () => {
  const result = collectUsedSkills([
    {
      type: "custom",
      id: "1",
      parentId: null,
      timestamp: "2026-06-09T00:00:00.000Z",
      customType: SKILL_USAGE_ENTRY_TYPE,
      data: { skillName: "pi-oss-bootstrap" },
    },
    {
      type: "custom",
      id: "2",
      parentId: "1",
      timestamp: "2026-06-09T00:00:01.000Z",
      customType: SKILL_USAGE_ENTRY_TYPE,
      data: { skillName: "pi-oss-bootstrap" },
    },
  ]);

  assert.deepEqual(result, ["pi-oss-bootstrap"]);
});

test("collectUsedSkills deduplicates mixed sources in first-occurrence order and ignores invalid records", () => {
  const result = collectUsedSkills([
    {
      type: "message",
      id: "1",
      parentId: null,
      timestamp: "2026-06-09T00:00:00.000Z",
      message: { role: "user", content: [{ type: "text", text: "/skill:parsed-first" }], timestamp: 1 },
    },
    {
      type: "custom",
      id: "2",
      parentId: "1",
      timestamp: "2026-06-09T00:00:01.000Z",
      customType: SKILL_USAGE_ENTRY_TYPE,
      data: { skillName: "recorded-second" },
    },
    {
      type: "message",
      id: "3",
      parentId: "2",
      timestamp: "2026-06-09T00:00:02.000Z",
      message: { role: "user", content: "/skill:recorded-second", timestamp: 2 },
    },
    {
      type: "custom",
      id: "4",
      parentId: "3",
      timestamp: "2026-06-09T00:00:03.000Z",
      customType: SKILL_USAGE_ENTRY_TYPE,
      data: {},
    },
    {
      type: "custom",
      id: "5",
      parentId: "4",
      timestamp: "2026-06-09T00:00:04.000Z",
      customType: SKILL_USAGE_ENTRY_TYPE,
      data: { skillName: 42 },
    },
    {
      type: "custom",
      id: "6",
      parentId: "5",
      timestamp: "2026-06-09T00:00:05.000Z",
      customType: SKILL_USAGE_ENTRY_TYPE,
      data: { skillName: "" },
    },
    {
      type: "custom",
      id: "7",
      parentId: "6",
      timestamp: "2026-06-09T00:00:06.000Z",
      customType: SKILL_USAGE_ENTRY_TYPE,
      data: { skillName: "  " },
    },
    {
      type: "custom",
      id: "8",
      parentId: "7",
      timestamp: "2026-06-09T00:00:07.000Z",
      customType: SKILL_USAGE_ENTRY_TYPE,
      data: { skillName: "recorded-third" },
    },
  ]);

  assert.deepEqual(result, ["parsed-first", "recorded-second", "recorded-third"]);
});
