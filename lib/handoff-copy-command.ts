import { convertToLlm, serializeConversation, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { collectObservedFiles } from "./observed-files.ts";
import { getHandoffMessages } from "./session-context.ts";
import { collectUsedSkills } from "./skill-suggestions.ts";

type HandoffCopyHandler = NonNullable<Parameters<ExtensionAPI["registerCommand"]>[1]["handler"]>;
type HandoffCopyContext = Parameters<HandoffCopyHandler>[1];

export type HandoffCopyDependencies = {
  generatePrompt: (
    ctx: HandoffCopyContext,
    conversationText: string,
    observedFiles: string[],
    suggestedSkills: string[],
  ) => Promise<string | null>;
  copyToClipboard: (text: string) => Promise<void>;
};

export const CLIPBOARD_HANDOFF_FAILED_PREFIX = "Clipboard handoff failed:";

export async function runHandoffCopyCommand(
  _args: string,
  ctx: HandoffCopyContext,
  deps: HandoffCopyDependencies,
): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify("/handoff:copy requires interactive or RPC UI support", "error");
    return;
  }

  if (!ctx.model) {
    ctx.ui.notify("Select a model before running /handoff:copy", "error");
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
    const prompt = await deps.generatePrompt(ctx, conversationText, observedFiles, suggestedSkills);
    if (!prompt) {
      ctx.ui.notify("Cancelled", "info");
      return;
    }

    await deps.copyToClipboard(prompt);
    ctx.ui.notify("Handoff prompt copied to clipboard", "info");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.ui.notify(`${CLIPBOARD_HANDOFF_FAILED_PREFIX} ${message}`, "error");
  }
}
