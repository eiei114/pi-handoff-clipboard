import assert from "node:assert/strict";
import test from "node:test";
import {
  behaviorAssertions,
  parseJsonLines,
  parseOsc52Payloads,
  sanitizeLocalPaths,
  VERIFICATION_CONTRACT,
} from "../scripts/pi-sdk-smoke-contract.mjs";

const command = { name: "handoff:copy", source: "extension", description: "Copy a next-session handoff" };
const prompt = { type: "response", command: "prompt", success: true, data: { disposition: "handled" } };
const success = {
  type: "extension_ui_request",
  method: "notify",
  notifyType: "info",
  message: "Handoff prompt copied to clipboard",
};
const error = {
  type: "extension_ui_request",
  method: "notify",
  notifyType: "error",
  message: "No conversation context available to hand off",
};
const clipboard = { channel: "native smoke clipboard", verified: true, text: "generated handoff" };
const passed = (caseName, observed) => behaviorAssertions(caseName, observed).every((item) => item.passed);

test("smoke contract parses JSONL and captured OSC 52 payloads", () => {
  assert.equal(VERIFICATION_CONTRACT, "pi-sdk-behavior-v2");
  assert.deepEqual(parseJsonLines(`not-json\r\n${JSON.stringify(prompt)}\n`), [prompt]);
  assert.deepEqual(parseJsonLines(`\u001b]52;c;aGFuZG9mZg==\u0007${JSON.stringify(prompt)}\n`), [prompt]);
  assert.deepEqual(parseOsc52Payloads("\u001b]52;c;aGFuZG9mZg==\u0007"), ["handoff"]);
});

test("recorded evidence removes raw, slash-normalized, and JSON-escaped local paths", () => {
  const root = "C:\\Users\\private\\checkout";
  const evidence = [
    `${root}\\extensions\\index.ts`,
    `${root.replaceAll("\\", "/")}/node_modules/pi/README.md`,
    JSON.stringify({ docs: `${root}\\node_modules\\pi\\docs` }),
  ].join("\n");
  const sanitized = sanitizeLocalPaths(evidence, [root]);
  assert.equal(sanitized.match(/<local-path>/g)?.length, 3);
  assert.doesNotMatch(sanitized, /C:\\Users\\private|C:\/Users\/private/);
});

test("extension registration requires the real namespaced command", () => {
  assert.equal(passed("extension_load", { commands: [command] }), true);
  for (const commands of [[], [{ ...command, name: "other" }], [{ ...command, source: "prompt" }]]) {
    assert.equal(passed("extension_load", { commands }), false);
  }
});

test("feature success requires handled RPC, the actual success notification, and copied output", () => {
  assert.equal(passed("happy_path", { promptResponse: prompt, notification: success, clipboard }), true);
  for (const observed of [
    { promptResponse: { ...prompt, success: false }, notification: success, clipboard },
    { promptResponse: prompt, notification: { ...success, notifyType: "error" }, clipboard },
    { promptResponse: prompt, notification: success, clipboard: { ...clipboard, verified: false } },
    { promptResponse: prompt, notification: success, clipboard: null },
  ]) {
    assert.equal(passed("happy_path", observed), false);
  }
});

test("error path requires the handled empty-session notification and no completion request", () => {
  assert.equal(passed("error_path", { promptResponse: prompt, notification: error, noFeatureCompletionRequest: true }), true);
  assert.equal(passed("error_path", { promptResponse: prompt, notification: success, noFeatureCompletionRequest: true }), false);
  assert.equal(passed("error_path", { promptResponse: prompt, notification: error, noFeatureCompletionRequest: false }), false);
});

test("reload requires second-process registration, feature response, and clean exit", () => {
  const good = behaviorAssertions("reload_cleanup", {
    commands: [command],
    promptResponse: prompt,
    notification: success,
    clipboard,
    exitCode: 0,
    runtimeErrors: false,
  });
  assert.deepEqual(good.map((item) => item.id), [
    "reloaded_extension_registered",
    "reloaded_feature_response",
    "clean_shutdown",
  ]);
  assert.ok(good.every((item) => item.passed));
  for (const overrides of [
    { commands: [] },
    { notification: null },
    { clipboard: { ...clipboard, verified: false } },
    { exitCode: 1 },
    { runtimeErrors: true },
  ]) {
    const observed = {
      commands: [command], promptResponse: prompt, notification: success, clipboard,
      exitCode: 0, runtimeErrors: false, ...overrides,
    };
    assert.ok(behaviorAssertions("reload_cleanup", observed).some((item) => !item.passed));
  }
});

test("native host shell requires the exact pinned CLI version and zero exit", () => {
  assert.equal(passed("host_shell", { exitCode: 0, output: "1.2.0\r\n", expectedVersion: "1.2.0" }), true);
  for (const observed of [
    { exitCode: 1, output: "1.2.0", expectedVersion: "1.2.0" },
    { exitCode: 0, output: "11.2.0", expectedVersion: "1.2.0" },
    { exitCode: 0, output: "1.2.0 with error", expectedVersion: "1.2.0" },
  ]) {
    assert.equal(passed("host_shell", observed), false);
  }
});
