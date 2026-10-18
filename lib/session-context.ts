import type { SessionEntry } from "@earendil-works/pi-coding-agent";

type AgentMessage = Extract<SessionEntry, { type: "message" }>["message"];

function entryToMessage(entry: SessionEntry): AgentMessage | undefined {
  if (entry.type === "message") {
    return entry.message;
  }

  if (entry.type === "compaction") {
    return {
      role: "compactionSummary",
      summary: entry.summary,
      tokensBefore: entry.tokensBefore,
      timestamp: new Date(entry.timestamp).getTime(),
    };
  }

  return undefined;
}

export function getHandoffMessages(branch: SessionEntry[]): AgentMessage[] {
  let compactionIndex = -1;

  for (let index = branch.length - 1; index >= 0; index -= 1) {
    if (branch[index]?.type === "compaction") {
      compactionIndex = index;
      break;
    }
  }

  if (compactionIndex < 0) {
    const messages: AgentMessage[] = [];
    appendMessages(messages, branch, 0, branch.length);
    return messages;
  }

  const compaction = branch[compactionIndex];
  const firstKeptIndex =
    compaction.type === "compaction"
      ? branch.findIndex((entry) => entry.id === compaction.firstKeptEntryId)
      : -1;

  const messages: AgentMessage[] = [];
  const compactionMessage = entryToMessage(compaction);
  if (compactionMessage !== undefined) {
    messages.push(compactionMessage);
  }
  if (firstKeptIndex >= 0) {
    appendMessages(messages, branch, firstKeptIndex, compactionIndex);
  }
  appendMessages(messages, branch, compactionIndex + 1, branch.length);
  return messages;
}

function appendMessages(
  messages: AgentMessage[],
  entries: SessionEntry[],
  startIndex: number,
  endIndex: number,
): void {
  for (let index = startIndex; index < endIndex; index += 1) {
    const message = entryToMessage(entries[index]!);
    if (message !== undefined) {
      messages.push(message);
    }
  }
}
