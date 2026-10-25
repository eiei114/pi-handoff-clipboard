export const VERIFICATION_CONTRACT = "pi-sdk-behavior-v2";
export const SDK_NAMES = [
  "@earendil-works/pi-agent-core",
  "@earendil-works/pi-ai",
  "@earendil-works/pi-coding-agent",
  "@earendil-works/pi-tui",
];
export const UNHANDLED_ERROR_PATTERN = /UnhandledPromiseRejection|uncaught exception|shutdown error/i;
export const EXTENSION_LOAD_ERROR_PATTERN = /Failed to load extension|Error loading extension/i;

export function parseJsonLines(output) {
  const withoutOsc52 = output.replace(/\u001b\]52;c;[A-Za-z0-9+/=]*\u0007/g, "");
  return withoutOsc52.split(/\r?\n/).flatMap((line) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}

export function parseOsc52Payloads(output) {
  return [...output.matchAll(/\u001b\]52;c;([A-Za-z0-9+/=]*)\u0007/g)].map((match) =>
    Buffer.from(match[1], "base64").toString("utf8"),
  );
}

export function sanitizeLocalPaths(output, paths) {
  let sanitized = `${output}`;
  for (const path of paths) {
    if (!path) continue;
    const forwardSlashPath = path.replaceAll("\\", "/");
    const variants = [
      path,
      forwardSlashPath,
      JSON.stringify(path).slice(1, -1),
      JSON.stringify(forwardSlashPath).slice(1, -1),
    ];
    for (const variant of new Set(variants)) sanitized = sanitized.replaceAll(variant, "<local-path>");
  }
  return sanitized;
}

export function createSmokeEnvironment(source, agentDirectory, platform) {
  const env = {
    ...source,
    PI_CODING_AGENT_DIR: agentDirectory,
    PI_OFFLINE: "1",
  };
  delete env.OPENAI_API_KEY;
  if (platform === "linux") {
    delete env.DISPLAY;
    delete env.WAYLAND_DISPLAY;
    delete env.TERMUX_VERSION;
  }
  return env;
}

function assertion(id, expected, observed, passed) {
  return { id, expected, observed: JSON.stringify(observed), passed: passed === true };
}

function findHandoffCommand(commands) {
  const command = commands?.find((item) => item.name === "handoff:copy" && item.source === "extension");
  return command ? { name: command.name, description: command.description, source: command.source } : null;
}

function isHandledPrompt(response) {
  return response?.type === "response" && response.command === "prompt" && response.success === true
    && response.data?.disposition === "handled";
}

function isSuccessNotification(notification) {
  return notification?.type === "extension_ui_request" && notification.method === "notify"
    && notification.notifyType === "info" && notification.message === "Handoff prompt copied to clipboard";
}

function isErrorNotification(notification) {
  return notification?.type === "extension_ui_request" && notification.method === "notify"
    && notification.notifyType === "error"
    && notification.message === "No conversation context available to hand off";
}

export function behaviorAssertions(name, observed) {
  if (name === "extension_load") {
    const command = findHandoffCommand(observed.commands);
    return [assertion("extension_registered", "Actual Pi lists handoff:copy as an extension command",
      command, command !== null)];
  }

  if (name === "happy_path") {
    const passed = isHandledPrompt(observed.promptResponse) && isSuccessNotification(observed.notification)
      && observed.clipboard?.verified === true;
    return [assertion("feature_response", "Actual /handoff:copy handles the command, notifies success, and copies the generated handoff",
      { promptResponse: observed.promptResponse ?? null, notification: observed.notification ?? null,
        clipboard: observed.clipboard ?? null }, passed)];
  }

  if (name === "error_path") {
    const passed = isHandledPrompt(observed.promptResponse) && isErrorNotification(observed.notification)
      && observed.noFeatureCompletionRequest === true;
    return [assertion("handled_error", "An empty Pi session produces the extension's handled context error without a completion request",
      { promptResponse: observed.promptResponse ?? null, notification: observed.notification ?? null,
        noFeatureCompletionRequest: observed.noFeatureCompletionRequest === true }, passed)];
  }

  if (name === "reload_cleanup") {
    const command = findHandoffCommand(observed.commands);
    const success = isHandledPrompt(observed.promptResponse) && isSuccessNotification(observed.notification)
      && observed.clipboard?.verified === true;
    return [
      assertion("reloaded_extension_registered", "A second real Pi process registers handoff:copy", command, command !== null),
      assertion("reloaded_feature_response", "The second process handles /handoff:copy and copies its generated response",
        { promptResponse: observed.promptResponse ?? null, notification: observed.notification ?? null,
          clipboard: observed.clipboard ?? null }, success),
      assertion("clean_shutdown", "The second actual Pi process exits zero without unhandled or shutdown errors",
        { exitCode: observed.exitCode, runtimeErrors: observed.runtimeErrors }, observed.exitCode === 0 && observed.runtimeErrors === false),
    ];
  }

  if (name === "host_shell") {
    const passed = observed.exitCode === 0 && observed.output.trim() === observed.expectedVersion;
    return [assertion("native_shell_boundary", "The native host shell launches the locally pinned Pi CLI and returns its exact version",
      { exitCode: observed.exitCode, output: observed.output.trim(), expectedVersion: observed.expectedVersion }, passed)];
  }

  throw new Error(`Unknown smoke case: ${name}`);
}
