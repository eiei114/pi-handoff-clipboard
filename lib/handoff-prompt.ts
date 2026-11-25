import type { Message } from "@earendil-works/pi-ai";

export const HANDOFF_SYSTEM_PROMPT = `You generate clipboard-first handoff prompts for the next Pi session.

Rules:
- Match the user's language.
- Output only the final handoff prompt.
- Summarize the current conversation so a fresh Pi session can continue the work.
- Use imperative, next-session-start tone.
- Keep headings exact: ## Context, ## Files involved, ## Task, and optionally ## Suggested skills.
- Infer ## Task from the latest unresolved work in the conversation. Do not ask for or depend on a separately provided goal.
- Treat the observed files list as authoritative. Do not invent files beyond the observed list.
- Treat suggested skills as authoritative. Suggest only the listed skills, and omit the section entirely when none were used.
- If no observed files were captured, say so plainly inside ## Files involved instead of inventing file names.
- Do not duplicate content already captured in other artifacts such as PRDs, plans, ADRs, issues, commits, or diffs. Reference them by path or URL instead.
- Make the prompt self-contained enough that the next session can continue without this thread.`;

function formatList(items: string[], emptyLine: string): string {
  if (items.length === 0) {
    return emptyLine;
  }

  return items.map((item) => `- ${item}`).join("\n");
}

export function buildGenerationMessage(input: {
  conversationText: string;
  observedFiles: string[];
  suggestedSkills: string[];
}): Message {
  const observedFilesText = formatList(input.observedFiles, "- No observed files captured in this session.");
  const suggestedSkillsText =
    input.suggestedSkills.length > 0 ? formatList(input.suggestedSkills, "") : "(omit the section)";

  return {
    role: "user",
    content: [
      {
        type: "text",
        text: [
          "## Observed files (authoritative)",
          observedFilesText,
          "",
          "## Suggested skills (authoritative)",
          suggestedSkillsText,
          "",
          "## Conversation history",
          input.conversationText,
        ].join("\n"),
      },
    ],
    timestamp: Date.now(),
  };
}

export function normalizeGeneratedPrompt(prompt: string): string {
  const lines = prompt.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").split("\n");
  const kept: string[] = [];
  let fence: string | undefined;
  let pendingHeading: number | undefined;

  for (const line of lines) {
    const [, marker, suffix] = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line) ?? [];

    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && /^[ \t]*$/.test(suffix)) {
        fence = undefined;
      }
      kept.push(line);
      continue;
    }

    // Drop a candidate and its trailing blank lines only if the next content is a heading.
    if (!/^[ \t]*$/.test(line)) {
      if (pendingHeading !== undefined && /^##[ \t]/.test(line)) kept.length = pendingHeading;
      pendingHeading = /^## Suggested skills[ \t]*$/.test(line) ? kept.length : undefined;
    }

    if (marker && (marker[0] === "~" || !suffix.includes("`"))) fence = marker;
    kept.push(line);
  }

  // An empty section may also run to the end of the prompt.
  if (pendingHeading !== undefined) kept.length = pendingHeading;
  return kept.join("\n").trim();
}
