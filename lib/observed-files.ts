import path from "node:path";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";

export const OBSERVED_FILES_ENTRY_TYPE = "pi-handoff-clipboard:observed-files";

export const TRACKED_TOOL_NAMES = new Set([
  "read",
  "write",
  "edit",
  "grep",
  "find_files",
  "fff_multi_grep",
]);

type JsonRecord = Record<string, unknown>;

function toPosix(value: string): string {
  return value.replaceAll("\\", "/");
}

function looksLikePath(value: string): boolean {
  if (!value || value.length > 260) {
    return false;
  }

  if (/^https?:\/\//u.test(value)) {
    return false;
  }

  if (value.includes("\n")) {
    return false;
  }

  return (
    /^[a-zA-Z]:[\\/]/u.test(value) ||
    value.includes("/") ||
    value.includes("\\") ||
    /(^|\/)\.?[\w.-]+\.[a-zA-Z0-9]+$/u.test(value)
  );
}

function normalizeObservedPath(rawPath: string, cwd: string): string | undefined {
  const trimmed = rawPath.trim().replace(/^@/u, "");
  if (!looksLikePath(trimmed)) {
    return undefined;
  }

  if (path.isAbsolute(trimmed)) {
    const relative = path.relative(cwd, trimmed);
    if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
      return toPosix(relative);
    }

    return toPosix(path.normalize(trimmed));
  }

  const normalized = toPosix(path.normalize(trimmed));
  return normalized.replace(/^\.\//u, "");
}

function pushUnique(target: string[], seen: Set<string>, value: string | undefined): void {
  if (!value || seen.has(value)) {
    return;
  }

  seen.add(value);
  target.push(value);
}

function collectPathsFromUnknown(value: unknown, cwd: string, out: string[], seen: Set<string>, depth = 0): void {
  if (depth > 4 || value === null || value === undefined) {
    return;
  }

  if (typeof value === "string") {
    pushUnique(out, seen, normalizeObservedPath(value, cwd));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPathsFromUnknown(item, cwd, out, seen, depth + 1);
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  for (const [key, nested] of Object.entries(value as JsonRecord)) {
    if (["path", "file", "filePath", "fullOutputPath", "cwd"].includes(key) && typeof nested === "string") {
      pushUnique(out, seen, normalizeObservedPath(nested, cwd));
      continue;
    }

    if (["paths", "files", "matches", "items", "readFiles", "modifiedFiles"].includes(key)) {
      collectPathsFromUnknown(nested, cwd, out, seen, depth + 1);
      continue;
    }

    if (key === "text" || key === "content") {
      continue;
    }

    collectPathsFromUnknown(nested, cwd, out, seen, depth + 1);
  }
}

function collectPathsFromText(text: string, cwd: string, out: string[], seen: Set<string>): void {
  const lineMatchRegex = /^([^:\n]+\.[a-zA-Z0-9]+):(\d+)(?::|\b)/u;

  for (const line of text.split(/\r?\n/u)) {
    const match = line.trim().match(lineMatchRegex);
    if (!match?.[1]) {
      continue;
    }

    pushUnique(out, seen, normalizeObservedPath(match[1], cwd));
  }
}

export function extractObservedPathsFromToolCall(toolName: string, input: unknown, cwd: string): string[] {
  if (!TRACKED_TOOL_NAMES.has(toolName) || input === null || typeof input !== "object") {
    return [];
  }

  const paths: string[] = [];
  const seen = new Set<string>();
  const record = input as JsonRecord;

  if (typeof record.path === "string") {
    pushUnique(paths, seen, normalizeObservedPath(record.path, cwd));
  }

  if (Array.isArray(record.paths)) {
    for (const value of record.paths) {
      if (typeof value === "string") {
        pushUnique(paths, seen, normalizeObservedPath(value, cwd));
      }
    }
  }

  return paths;
}

export function extractObservedPathsFromToolResult(
  toolName: string,
  details: unknown,
  content: unknown,
  cwd: string,
): string[] {
  if (!TRACKED_TOOL_NAMES.has(toolName)) {
    return [];
  }

  const paths: string[] = [];
  const seen = new Set<string>();

  collectPathsFromUnknown(details, cwd, paths, seen);

  if (Array.isArray(content)) {
    for (const block of content) {
      if (block && typeof block === "object" && "type" in block && block.type === "text" && "text" in block) {
        collectPathsFromText(String(block.text), cwd, paths, seen);
      }
    }
  }

  return paths;
}

export function collectObservedFiles(branch: SessionEntry[], cwd: string): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();

  for (const entry of branch) {
    if (entry.type === "custom" && entry.customType === OBSERVED_FILES_ENTRY_TYPE) {
      const maybePaths =
        typeof entry.data === "object" && entry.data !== null && "paths" in entry.data ? entry.data.paths : undefined;

      if (Array.isArray(maybePaths)) {
        for (const observedPath of maybePaths) {
          if (typeof observedPath === "string") {
            pushUnique(paths, seen, normalizeObservedPath(observedPath, cwd));
          }
        }
      }
      continue;
    }

    if (entry.type !== "message" || entry.message.role !== "toolResult") {
      continue;
    }

    const recovered = extractObservedPathsFromToolResult(
      entry.message.toolName,
      entry.message.details,
      entry.message.content,
      cwd,
    );

    for (const recoveredPath of recovered) {
      pushUnique(paths, seen, recoveredPath);
    }
  }

  return paths;
}
