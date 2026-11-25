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

test("normalizeGeneratedPrompt preserves inline Suggested skills text", () => {
  const prompt = "## Context\nThe previous prompt ended with ## Suggested skills\n\n## Task\nB";
  assert.equal(normalizeGeneratedPrompt(prompt), prompt);
});

test("normalizeGeneratedPrompt preserves a populated Suggested skills section", () => {
  const prompt = "## Context\nA\n\n## Suggested skills\n\n- pi-oss-bootstrap\n\n## Task\nB";
  assert.equal(normalizeGeneratedPrompt(prompt), prompt);
});

test("normalizeGeneratedPrompt removes an empty heading without joining CRLF sections", () => {
  const prompt = "## Context\r\nA\r\n\r\n## Suggested skills \r\n \t\r\n## Task\r\nB";
  const normalized = normalizeGeneratedPrompt(prompt);
  assert.equal(normalized, "## Context\nA\n\n## Task\nB");
});

test("normalizeGeneratedPrompt removes an empty trailing heading with or without a final newline", () => {
  for (const suffix of ["", "\n \t\n"]) {
    assert.equal(normalizeGeneratedPrompt(`## Task\nB\n\n## Suggested skills${suffix}`), "## Task\nB");
  }
});

test("normalizeGeneratedPrompt preserves a section with content that starts with hashes", () => {
  const prompt = "## Suggested skills\n\n##literal\n\n## Task\nB";
  assert.equal(normalizeGeneratedPrompt(prompt), prompt);
});

test("normalizeGeneratedPrompt preserves a Suggested skills example in a code fence", () => {
  const prompt = ["## Task", "Keep this literal sample:", "", "```md", "## Suggested skills", "## Example", "```"].join("\n");
  assert.equal(normalizeGeneratedPrompt(prompt), prompt);
});

test("normalizeGeneratedPrompt removes an empty section after a longer tilde fence", () => {
  const example = ["## Context", "", "  ~~~~markdown", "~~~", "````", "~~~~ not a closer", "## Suggested skills", "## Example", "  ~~~~~  ", ""].join("\r\n");
  const prompt = `${example}\r\n## Suggested skills\r\n \t\r\n## Task\r\nB`;
  assert.equal(normalizeGeneratedPrompt(prompt), `${example.replaceAll("\r\n", "\n")}\n## Task\nB`);
});

test("normalizeGeneratedPrompt preserves a trailing example in an unclosed fence", () => {
  const prompt = "## Task\n\n```md\n## Suggested skills";
  assert.equal(normalizeGeneratedPrompt(prompt), prompt);
});

test("buildGenerationMessage survives serialization and restoration with no suggested skills", () => {
  const payload = buildGenerationMessage({
    conversationText: "history",
    observedFiles: [],
    suggestedSkills: [],
  });

  const restored = JSON.parse(JSON.stringify(payload));

  assert.deepEqual(restored, payload);
  assert.match(restored.content[0].text, /No observed files captured in this session/);
  assert.match(restored.content[0].text, /\(omit the section\)/);
});
