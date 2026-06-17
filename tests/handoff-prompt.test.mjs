import assert from "node:assert/strict";
import test from "node:test";

const { buildGenerationMessage, normalizeGeneratedPrompt } = await import("../lib/handoff-prompt.ts");

test("buildGenerationMessage embeds authoritative lists", () => {
  const message = buildGenerationMessage({
    conversationText: "history",
    observedFiles: ["src/index.ts"],
    suggestedSkills: ["pi-oss-bootstrap"],
  });

  assert.equal(message.role, "user");
  assert.match(message.content[0].text, /src\/index.ts/);
  assert.match(message.content[0].text, /pi-oss-bootstrap/);
  assert.doesNotMatch(message.content[0].text, /Goal for next session/);
  assert.match(message.content[0].text, /Conversation history/);
});

test("buildGenerationMessage states when no observed files were captured", () => {
  const message = buildGenerationMessage({
    conversationText: "history",
    observedFiles: [],
    suggestedSkills: [],
  });

  assert.match(message.content[0].text, /No observed files captured in this session/);
  assert.match(message.content[0].text, /\(omit the section\)/);
});

test("normalizeGeneratedPrompt removes empty suggested-skills sections", () => {
  const normalized = normalizeGeneratedPrompt(`## Context\nA\n\n## Suggested skills\n\n## Task\nB`);
  assert.equal(normalized, "## Context\nA\n\n## Task\nB");
});
