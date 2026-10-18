import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const autoReleaseWorkflow = await readFile(new URL("../.github/workflows/auto-release.yml", import.meta.url), "utf8");
const publishWorkflow = await readFile(new URL("../.github/workflows/publish.yml", import.meta.url), "utf8");
const releaseDocs = await readFile(new URL("../docs/release.md", import.meta.url), "utf8");
const contributing = await readFile(new URL("../CONTRIBUTING.md", import.meta.url), "utf8");

function releaseTagValidationScript() {
  const stepStart = publishWorkflow.indexOf("      - name: Validate release tag");
  assert.notEqual(stepStart, -1);
  const runHeader = publishWorkflow.indexOf("        run: |", stepStart);
  assert.notEqual(runHeader, -1);
  const scriptStart = publishWorkflow.indexOf("\n", runHeader) + 1;
  const nextStep = publishWorkflow.indexOf("\n      - name:", scriptStart);
  assert.notEqual(nextStep, -1);

  return publishWorkflow
    .slice(scriptStart, nextStep)
    .split(/\r?\n/)
    .map((line) => line.replace(/^ {10}/, ""))
    .join("\n");
}

function runReleaseTagValidation(repo, releaseRef) {
  const bash = process.platform === "win32"
    ? join(resolve(execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim(), "..", "..", ".."), "bin", "bash.exe")
    : "bash";
  const result = spawnSync(
    bash,
    ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", releaseTagValidationScript()],
    {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, RELEASE_REF: releaseRef },
    },
  );
  assert.ifError(result.error);
  return result;
}

function git(repo, ...args) {
  execFileSync("git", args, { cwd: repo, stdio: "ignore" });
}

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
  assert.match(publishWorkflow, /git rev-parse "refs\/tags\/\$\{REF\}\^\{commit\}"/);
  assert.match(publishWorkflow, /Checked-out commit \$\{CHECKED_OUT_COMMIT\} does not match release tag/);
  assert.match(publishWorkflow, /Tag \$\{REF\} does not match package version/);
});

test("publish validation rejects a same-version branch that differs from the release tag", () => {
  const repo = mkdtempSync(join(tmpdir(), "pi-handoff-release-tag-"));

  try {
    git(repo, "init", "--quiet");
    git(repo, "config", "user.name", "Release workflow test");
    git(repo, "config", "user.email", "release-workflow-test@example.invalid");
    writeFileSync(join(repo, "package.json"), '{"version":"0.1.13"}\n');
    writeFileSync(join(repo, "tag-content.txt"), "tagged release\n");
    git(repo, "add", "package.json", "tag-content.txt");
    git(repo, "commit", "--quiet", "-m", "tagged release");
    git(repo, "tag", "v0.1.13");

    git(repo, "switch", "--create", "v0.1.13");
    writeFileSync(join(repo, "branch-content.txt"), "branch-only content\n");
    git(repo, "add", "branch-content.txt");
    git(repo, "commit", "--quiet", "-m", "same-version branch");

    const missingTagValidation = runReleaseTagValidation(repo, "v0.1.14");
    assert.notEqual(missingTagValidation.status, 0, missingTagValidation.stdout);
    assert.match(missingTagValidation.stderr, /is not an existing tag/);

    const branchValidation = runReleaseTagValidation(repo, "v0.1.13");
    assert.notEqual(branchValidation.status, 0, branchValidation.stdout);
    assert.match(branchValidation.stderr, /does not match release tag/);

    git(repo, "switch", "--detach", "refs/tags/v0.1.13");
    const tagValidation = runReleaseTagValidation(repo, "v0.1.13");
    assert.equal(tagValidation.status, 0, tagValidation.stderr || tagValidation.stdout);
  } finally {
    rmSync(repo, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test("release workflow explicitly hands off the tagged version to npm publish", () => {
  assert.match(autoReleaseWorkflow, /gh workflow run publish\.yml --ref "\$TAG" -f ref="\$TAG"/);
});

test("release guidance requires an explicit dispatch after a version bump merge", () => {
  assert.match(contributing, /gh workflow run auto-release\.yml --ref main/);
  assert.match(releaseDocs, /gh workflow run auto-release\.yml --ref main/);
  assert.match(releaseDocs, /Merging a version bump to `main` does not trigger release or publication/);
});
