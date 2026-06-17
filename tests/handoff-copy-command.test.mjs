import assert from "node:assert/strict";
import test from "node:test";

const { CLIPBOARD_HANDOFF_FAILED_PREFIX, runHandoffCopyCommand } = await import(
  "../lib/handoff-copy-command.ts"
);

function createContext(overrides = {}) {
  const notifications = [];

  return {
    context: {
      hasUI: true,
      model: { provider: "test" },
      cwd: "/repo",
      sessionManager: {
        getBranch: () => [
          {
            type: "message",
            id: "1",
            parentId: null,
            timestamp: "2026-06-09T00:00:00.000Z",
            message: { role: "user", content: "continue the refactor", timestamp: 1 },
          },
        ],
      },
      ui: {
        notify(message, level) {
          notifications.push({ message, level });
        },
        custom: async () => "generated prompt",
      },
      ...overrides,
    },
    notifications,
  };
}

test("runHandoffCopyCommand copies generated prompt to clipboard", async () => {
  const { context, notifications } = createContext();
  let copied = null;

  await runHandoffCopyCommand("", context, {
    generatePrompt: async () => "## Context\nA",
    copyToClipboard: async (prompt) => {
      copied = prompt;
    },
  });

  assert.equal(copied, "## Context\nA");
  assert.deepEqual(notifications, [{ message: "Handoff prompt copied to clipboard", level: "info" }]);
});

test("runHandoffCopyCommand surfaces clipboard failure without fallback artifacts", async () => {
  const { context, notifications } = createContext();
  let writeAttempted = false;

  await runHandoffCopyCommand("", context, {
    generatePrompt: async () => "## Context\nA",
    copyToClipboard: async () => {
      writeAttempted = true;
      throw new Error("clipboard unavailable");
    },
  });

  assert.equal(writeAttempted, true);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].level, "error");
  assert.match(notifications[0].message, new RegExp(`${CLIPBOARD_HANDOFF_FAILED_PREFIX} clipboard unavailable`));
});

test("runHandoffCopyCommand stops when generation is cancelled", async () => {
  const { context, notifications } = createContext();
  let copied = false;

  await runHandoffCopyCommand("", context, {
    generatePrompt: async () => null,
    copyToClipboard: async () => {
      copied = true;
    },
  });

  assert.equal(copied, false);
  assert.deepEqual(notifications, [{ message: "Cancelled", level: "info" }]);
});

test("runHandoffCopyCommand rejects empty conversation context", async () => {
  const { context, notifications } = createContext({
    sessionManager: { getBranch: () => [] },
  });

  await runHandoffCopyCommand("", context, {
    generatePrompt: async () => "## Context\nA",
    copyToClipboard: async () => {},
  });

  assert.deepEqual(notifications, [
    { message: "No conversation context available to hand off", level: "error" },
  ]);
});
