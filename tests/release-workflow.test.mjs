import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const autoReleaseWorkflow = await readFile(new URL("../.github/workflows/auto-release.yml", import.meta.url), "utf8");
const publishWorkflow = await readFile(new URL("../.github/workflows/publish.yml", import.meta.url), "utf8");
const releaseDocs = await readFile(new URL("../docs/release.md", import.meta.url), "utf8");
const contributing = await readFile(new URL("../CONTRIBUTING.md", import.meta.url), "utf8");

function workflowTriggers(workflow) {
  const triggerConfig = workflow.split(/^permissions:[ \t]*$/m, 1)[0].split(/^on:[ \t]*$/m)[1] ?? "";
  return [...triggerConfig.matchAll(/^  ([a-z][\w-]*):[ \t]*$/gm)].map(([, event]) => event);
}

test("release and publish workflows cannot start from a push or release event", () => {
  assert.deepEqual(workflowTriggers(autoReleaseWorkflow), ["workflow_dispatch"]);
  assert.deepEqual(workflowTriggers(publishWorkflow), ["workflow_dispatch"]);
  assert.match(autoReleaseWorkflow, /GITHUB_REF" != "refs\/heads\/main"/);
  assert.match(publishWorkflow, /Publish workflow requires an explicit v/);
  assert.match(publishWorkflow, /git show-ref --verify --quiet "refs\/tags\/\$\{REF\}"/);
  assert.match(publishWorkflow, /Tag \$\{REF\} does not match package version/);
});

test("release workflow explicitly hands off the tagged version to npm publish", () => {
  assert.match(autoReleaseWorkflow, /gh workflow run publish\.yml --ref "\$TAG" -f ref="\$TAG"/);
});

test("release guidance requires an explicit dispatch after a version bump merge", () => {
  assert.match(contributing, /gh workflow run auto-release\.yml --ref main/);
  assert.match(releaseDocs, /gh workflow run auto-release\.yml --ref main/);
  assert.match(releaseDocs, /Merging a version bump to `main` does not trigger release or publication/);
});
