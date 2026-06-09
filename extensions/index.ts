import { complete } from "@earendil-works/pi-ai";
import {
  BorderedLoader,
  convertToLlm,
  copyToClipboard,
  serializeConversation,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
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
import { getHandoffMessages } from "../lib/session-context.ts";
import { collectUsedSkills, parseSkillCommand, SKILL_USAGE_ENTRY_TYPE } from "../lib/skill-suggestions.ts";

async function generatePrompt(
  ctx: Parameters<NonNullable<Parameters<ExtensionAPI["registerCommand"]>[1]["handler"]>>[1],
  goal: string,
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
            goal,
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
    description: "Generate a next-session handoff prompt and copy it to the clipboard",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/handoff:copy requires interactive or RPC UI support", "error");
        return;
      }

      if (!ctx.model) {
        ctx.ui.notify("Select a model before running /handoff:copy", "error");
        return;
      }

      const goal = await ctx.ui.input("Next-session goal:", "");
      if (goal === undefined) {
        ctx.ui.notify("Cancelled", "info");
        return;
      }

      const trimmedGoal = goal.trim();
      if (!trimmedGoal) {
        ctx.ui.notify("Goal is required for /handoff:copy", "error");
        return;
      }

      const messages = getHandoffMessages(ctx.sessionManager.getBranch());
      if (messages.length === 0) {
        ctx.ui.notify("No conversation context available to hand off", "error");
        return;
      }

      const conversationText = serializeConversation(convertToLlm(messages));
      const observedFiles = collectObservedFiles(ctx.sessionManager.getBranch(), ctx.cwd);
      const suggestedSkills = collectUsedSkills(ctx.sessionManager.getBranch());

      try {
        const prompt = await generatePrompt(ctx, trimmedGoal, conversationText, observedFiles, suggestedSkills);
        if (!prompt) {
          ctx.ui.notify("Cancelled", "info");
          return;
        }

        await copyToClipboard(prompt);
        ctx.ui.notify("Handoff prompt copied to clipboard", "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Clipboard handoff failed: ${message}`, "error");
      }
    },
  });
}
