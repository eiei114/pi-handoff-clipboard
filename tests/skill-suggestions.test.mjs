import assert from "node:assert/strict";
import test from "node:test";

const { collectUsedSkills, parseSkillCommand, SKILL_USAGE_ENTRY_TYPE } = await import(
  "../lib/skill-suggestions.ts"
);

test("parseSkillCommand reads slash skill invocations", () => {
  assert.equal(parseSkillCommand("/skill:handoff"), "handoff");
  assert.equal(parseSkillCommand("/skill:handoff extra context"), "handoff");
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
