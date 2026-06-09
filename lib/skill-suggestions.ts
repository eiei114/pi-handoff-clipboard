import type { SessionEntry } from "@earendil-works/pi-coding-agent";

export const SKILL_USAGE_ENTRY_TYPE = "pi-handoff-clipboard:skill-use";

function pushUnique(values: string[], seen: Set<string>, value: string | undefined): void {
  if (!value) {
    return;
  }

  const normalized = value.trim();
  if (!normalized || seen.has(normalized)) {
    return;
  }

  seen.add(normalized);
  values.push(normalized);
}

export function parseSkillCommand(text: string): string | undefined {
  const trimmed = text.trim();

  const slashMatch = trimmed.match(/^\/skill:([^\s]+)$/u) ?? trimmed.match(/^\/skill:([^\s]+)\s+/u);
  if (slashMatch?.[1]) {
    return slashMatch[1].trim();
  }

  const tagMatch = trimmed.match(/<skill\s+name=["']([^"']+)["']/u);
  if (tagMatch?.[1]) {
    return tagMatch[1].trim();
  }

  return undefined;
}

export function collectUsedSkills(branch: SessionEntry[]): string[] {
  const skills: string[] = [];
  const seen = new Set<string>();

  for (const entry of branch) {
    if (entry.type === "custom" && entry.customType === SKILL_USAGE_ENTRY_TYPE) {
      const skillName =
        typeof entry.data === "object" && entry.data !== null && "skillName" in entry.data
          ? entry.data.skillName
          : undefined;

      pushUnique(skills, seen, typeof skillName === "string" ? skillName : undefined);
      continue;
    }

    if (entry.type !== "message" || entry.message.role !== "user") {
      continue;
    }

    const content = entry.message.content;
    if (typeof content === "string") {
      pushUnique(skills, seen, parseSkillCommand(content));
      continue;
    }

    for (const block of content) {
      if (block.type === "text") {
        pushUnique(skills, seen, parseSkillCommand(block.text));
      }
    }
  }

  return skills;
}
