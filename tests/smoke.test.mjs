import assert from "node:assert/strict";
import { execSync } from "node:child_process";
function parseNpmPackDryRun(output) {
  for (let start = output.search(/[\[{]/); start !== -1; ) {
    const closing = [];
    let inString = false;
    let escaped = false;

    for (let end = start; end < output.length; end += 1) {
      const character = output[end];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
      } else if (character === "[") {
        closing.push("]");
      } else if (character === "{") {
        closing.push("}");
      } else if (character === "]" || character === "}") {
        if (closing.pop() === character && closing.length === 0) {
          try {
            const parsed = JSON.parse(output.slice(start, end + 1));
            const results = Array.isArray(parsed)
              ? parsed
              : parsed && typeof parsed === "object"
                ? Array.isArray(parsed.files)
                  ? [parsed]
                  : Object.values(parsed)
                : [];
            const packages = results.filter((entry) => Array.isArray(entry?.files));
            if (packages.length > 0) {
              return packages;
            }
          } catch {
            // Continue searching: npm may include bracketed non-JSON output.
          }
          break;
        }
      }
    }

    const nextStart = output.slice(start + 1).search(/[\[{]/);
    start = nextStart === -1 ? -1 : start + nextStart + 1;
  }

  throw new Error("npm pack --dry-run --json did not include a valid package array");
}

import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const contributing = await readFile(new URL("../CONTRIBUTING.md", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const releaseDocs = await readFile(new URL("../docs/release.md", import.meta.url), "utf8");
const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const workflowDirectory = new URL("../.github/workflows/", import.meta.url);
const activeWorkflowFiles = (await readdir(workflowDirectory)).filter((file) => /\.ya?ml$/i.test(file));
const activeWorkflowSources = await Promise.all(
  activeWorkflowFiles.map(async (file) => [file, await readFile(new URL(file, workflowDirectory), "utf8")]),
);

test("npm pack dry-run parser handles npm 12 object output and npm 11 arrays", () => {
  const packageResult = { files: [{ path: "package.json" }] };
  const npm11Output = `npm warning [diagnostic]\n${JSON.stringify([packageResult])}\nextra [metadata]`;
  const npm12Output = `npm warning [diagnostic]\n${JSON.stringify({ "pi-handoff-clipboard": packageResult })}\nextra [metadata]`;

  assert.deepEqual(parseNpmPackDryRun(npm11Output), [packageResult]);
  assert.deepEqual(parseNpmPackDryRun(npm12Output), [packageResult]);
});

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

test("README pins a concrete published version for install", () => {
  // The pinned version moves with each release, so assert the shape rather than a
  // hardcoded number that goes stale on the next publish.
  assert.match(readme, new RegExp(`pi install npm:${packageJson.name}@\\d+\\.\\d+\\.\\d+`));
});

test("changelog documents the current package version", () => {
  const versionHeading = `## [${packageJson.version}]`;
  assert.ok(changelog.includes(versionHeading), `expected CHANGELOG to include ${versionHeading}`);
});

test("contributing release docs require an explicit release dispatch", () => {
  assert.match(contributing, /gh workflow run auto-release\.yml --ref main/);
  assert.doesNotMatch(contributing, /^npm version patch$/m);
  assert.doesNotMatch(contributing, /^git push$/m);
  assert.match(releaseDocs, /auto-release\.yml/);
  assert.match(releaseDocs, /gh workflow run publish\.yml/);
});

test("release workflows are dispatch-only and cannot run automatically", async () => {
  assert.ok(activeWorkflowFiles.includes("ci.yml"));

  // The real invariant in this repo: release/publish workflows exist, but only
  // behind workflow_dispatch. A push/release/schedule trigger would let a version
  // bump publish itself, which is the hazard these tests guard.
  for (const file of ["auto-release.yml", "publish.yml"]) {
    const source = await readFile(new URL(`../.github/workflows/${file}`, import.meta.url), "utf8");
    assert.match(source, /workflow_dispatch:/, `${file} must be manually dispatched`);
    const triggerBlock = source.split(/\njobs:/)[0].split(/^on:/m)[1] ?? "";
    assert.doesNotMatch(triggerBlock, /^\s+(push|release|schedule|pull_request):/m,
      `${file} must not trigger automatically`);
  }
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
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
    });
  const packedPaths = parseNpmPackDryRun(packOutput)[0].files.map((file) => file.path);

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
