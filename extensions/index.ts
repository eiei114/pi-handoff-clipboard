import { complete } from "@earendil-works/pi-ai";
import {
  BorderedLoader,
  copyToClipboard,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { runHandoffCopyCommand } from "../lib/handoff-copy-command.ts";
import {
  buildGenerationMessage,
  HANDOFF_SYSTEM_PROMPT,
  normalizeGeneratedPrompt,
} from "../lib/handoff-prompt.ts";
import {
  collectObservedFiles,
  extractObservedPathsFromToolCall,
  extractObservedPathsFromToolResult,
  OBSERVED_FILES_ENTRY_TYPE,
} from "../lib/observed-files.ts";
import { parseSkillCommand, SKILL_USAGE_ENTRY_TYPE } from "../lib/skill-suggestions.ts";

async function generatePrompt(
  ctx: Parameters<NonNullable<Parameters<ExtensionAPI["registerCommand"]>[1]["handler"]>>[1],
  conversationText: string,
  observedFiles: string[],
  suggestedSkills: string[],
): Promise<string | null> {
  if (!ctx.model) {
    throw new Error("No model selected");
  }

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model);
  if (!auth.ok || !auth.apiKey) {
    throw new Error(auth.ok ? `No API key for ${ctx.model.provider}` : auth.error);
  }

  const runCompletion = async (signal?: AbortSignal): Promise<string | null> => {
    const response = await complete(
      ctx.model!,
      {
        systemPrompt: HANDOFF_SYSTEM_PROMPT,
        messages: [
          buildGenerationMessage({
            conversationText,
            observedFiles,
            suggestedSkills,
          }),
        ],
      },
      { apiKey: auth.apiKey, headers: auth.headers, signal },
    );

    if (response.stopReason === "aborted") {
      return null;
    }

    const text = response.content
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return text ? normalizeGeneratedPrompt(text) : null;
  };

  const interactiveResult = await ctx.ui.custom<string | null>((tui, theme, _keybindings, done) => {
    const loader = new BorderedLoader(tui, theme, "Generating clipboard handoff...");
    loader.onAbort = () => done(null);

    runCompletion(loader.signal)
      .then(done)
      .catch((error) => {
        console.error("Failed to generate handoff prompt", error);
        done(null);
      });

    return loader;
  });

  if (interactiveResult === undefined) {
    return runCompletion();
  }

  return interactiveResult;
}

export default function (pi: ExtensionAPI) {
  pi.on("input", async (event) => {
    const skillName = parseSkillCommand(event.text);
    if (skillName) {
      pi.appendEntry(SKILL_USAGE_ENTRY_TYPE, { skillName });
    }

    return { action: "continue" } as const;
  });

  pi.on("tool_call", async (event, ctx) => {
    const paths = extractObservedPathsFromToolCall(event.toolName, event.input, ctx.cwd);
    if (paths.length > 0) {
      pi.appendEntry(OBSERVED_FILES_ENTRY_TYPE, { toolName: event.toolName, paths });
    }
  });

  pi.on("tool_result", async (event, ctx) => {
    const paths = extractObservedPathsFromToolResult(event.toolName, event.details, event.content, ctx.cwd);
    if (paths.length > 0) {
      pi.appendEntry(OBSERVED_FILES_ENTRY_TYPE, { toolName: event.toolName, paths });
    }
  });

  pi.registerCommand("handoff:copy", {
    description: "Generate a handoff summary from the current conversation and copy it to the clipboard",
    handler: async (_args, ctx) =>
      runHandoffCopyCommand(_args, ctx, {
        generatePrompt,
        copyToClipboard,
      }),
  });
}
