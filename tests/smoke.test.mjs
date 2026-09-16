import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const autoReleaseWorkflow = await readFile(new URL("../.github/workflows/auto-release.yml", import.meta.url), "utf8");
const publishWorkflow = await readFile(new URL("../.github/workflows/publish.yml", import.meta.url), "utf8");
const contributing = await readFile(new URL("../CONTRIBUTING.md", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const releaseDocs = await readFile(new URL("../docs/release.md", import.meta.url), "utf8");
const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");

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

test("README pinned install example tracks the package version", () => {
  assert.ok(readme.includes(`pi install npm:${packageJson.name}@${packageJson.version}`));
});

test("changelog documents the current package version", () => {
  const versionHeading = `## [${packageJson.version}]`;
  assert.ok(changelog.includes(versionHeading), `expected CHANGELOG to include ${versionHeading}`);
});

test("contributing release docs avoid manual tag pushes", () => {
  assert.match(contributing, /npm version patch/);
  assert.match(contributing, /^git push$/m);
  assert.doesNotMatch(contributing, /--follow-tags/);
  assert.doesNotMatch(contributing, /^git push --/m);
  assert.doesNotMatch(contributing, /^git push origin/m);
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

const SCAFFOLD_SAMPLE_PATHS = [
  "../prompts/example.md",
  "../skills/example-skill/SKILL.md",
  "../themes/example-theme.json",
];

test("scaffold sample files exist for local Pi discovery", async () => {
  await Promise.all(
    SCAFFOLD_SAMPLE_PATHS.map(async (relativePath) => {
      const content = await readFile(new URL(relativePath, import.meta.url), "utf8");
      assert.ok(content.trim().length > 0, `expected non-empty scaffold sample at ${relativePath}`);
    }),
  );
});

test("published package manifest excludes scaffold sample directories", () => {
  const publishedFiles = packageJson.files;

  for (const directory of ["prompts", "skills", "themes"]) {
    assert.ok(
      !publishedFiles.some((entry) => entry === directory || entry.startsWith(`${directory}/`)),
      `expected package files to exclude ${directory}/ scaffold samples`,
    );
  }
});

test("npm pack dry-run excludes scaffold sample directories", () => {
  const packOutput = execSync("npm pack --dry-run --json", {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    shell: true,
  });
  const packedPaths = JSON.parse(packOutput)[0].files.map((file) => file.path);

  for (const directory of ["prompts/", "skills/", "themes/"]) {
    assert.ok(
      !packedPaths.some((path) => path.startsWith(directory)),
      `expected dry-run tarball to exclude ${directory} scaffold samples`,
    );
  }
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
