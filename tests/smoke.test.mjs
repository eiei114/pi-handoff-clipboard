import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const autoReleaseWorkflow = await readFile(new URL("../.github/workflows/auto-release.yml", import.meta.url), "utf8");
const publishWorkflow = await readFile(new URL("../.github/workflows/publish.yml", import.meta.url), "utf8");
const contributing = await readFile(new URL("../CONTRIBUTING.md", import.meta.url), "utf8");
const releaseDocs = await readFile(new URL("../docs/release.md", import.meta.url), "utf8");

test("package declares pi resources", () => {
  assert.deepEqual(packageJson.pi.extensions, ["./extensions"]);
});

test("package is discoverable as a Pi package", () => {
  assert.ok(packageJson.keywords.includes("pi-package"));
});

test("package uses public publish config", () => {
  assert.equal(packageJson.publishConfig.access, "public");
});

test("package identity matches repository", () => {
  assert.equal(packageJson.name, "pi-handoff-clipboard");
  assert.match(packageJson.repository.url, /eiei114\/pi-handoff-clipboard/);
});

test("contributing release docs avoid manual tag pushes", () => {
  assert.match(contributing, /npm version patch/);
  assert.match(contributing, /git push/);
  assert.doesNotMatch(contributing, /--follow-tags/);
  assert.match(releaseDocs, /auto-release\.yml/);
  assert.match(releaseDocs, /gh workflow run publish\.yml/);
});

test("template includes npm release workflow handoff", () => {
  assert.match(autoReleaseWorkflow, /actions:\s*write/);
  assert.match(autoReleaseWorkflow, /contents:\s*write/);
  assert.match(autoReleaseWorkflow, /gh workflow run publish\.yml/);
  assert.match(publishWorkflow, /id-token:\s*write/);
  assert.match(publishWorkflow, /workflow_dispatch:/);
  assert.match(publishWorkflow, /npm publish --access public/);
});

test("extension registers the clipboard handoff command", async () => {
  const registeredCommands = [];
  const extension = (await import("../extensions/index.ts")).default;

  extension({
    on() {},
    appendEntry() {},
    registerCommand(name, options) {
      registeredCommands.push({ name, options });
    },
  });

  assert.ok(registeredCommands.some((command) => command.name === "handoff:copy"));
  assert.equal(registeredCommands.length, 1);
});
