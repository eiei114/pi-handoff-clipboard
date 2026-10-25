import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  behaviorAssertions,
  createSmokeEnvironment,
  EXTENSION_LOAD_ERROR_PATTERN,
  parseJsonLines,
  parseOsc52Payloads,
  sanitizeLocalPaths,
  SDK_NAMES,
  UNHANDLED_ERROR_PATTERN,
  VERIFICATION_CONTRACT,
} from "./pi-sdk-smoke-contract.mjs";

const PROBE_TIMEOUT_MS = 15_000;
const CLEANUP_GRACE_MS = 1_000;
const root = resolve(import.meta.dirname, "..");
const reportPath = resolve(root, "docs/verification/pi-sdk-smoke.json");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const GENERATED_HANDOFF = [
  "## Context",
  "Continue the Pi SDK compatibility smoke check.",
  "",
  "## Files involved",
  "- No observed files captured in this session.",
  "",
  "## Task",
  "Run the compatibility check again.",
].join("\n");
const INITIAL_PROMPT = "The smoke session is preparing a clipboard handoff.";
const FEATURE_SYSTEM_PROMPT = "You generate clipboard-first handoff prompts for the next Pi session.";
const RPC_ARGS = [
  "--offline",
  "--no-session",
  "--no-tools",
  "--no-extensions",
  "--no-skills",
  "--no-context-files",
  "--no-prompt-templates",
  "--no-mcp",
  "--extension",
  ".",
  "--mode",
  "rpc",
  "--model",
  "pi-sdk-smoke/smoke-model",
];
const agentDir = mkdtempSync(join(tmpdir(), "pi-sdk-smoke-"));
const env = createSmokeEnvironment(process.env, agentDir, process.platform);
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const piPackageDir = resolve(root, "node_modules/@earendil-works/pi-coding-agent");
const piManifest = readJson(resolve(piPackageDir, "package.json"));
const piCli = resolve(piPackageDir, piManifest.bin.pi);

function verifySdkPins() {
  const expectedVersions = Object.fromEntries(SDK_NAMES.map((name) => [name, "1.2.0"]));
  for (const name of SDK_NAMES) {
    const declaredVersion = packageJson.devDependencies?.[name];
    const installedVersion = readJson(resolve(root, "node_modules", name, "package.json")).version;
    assert.equal(declaredVersion, expectedVersions[name], `${name} must be pinned exactly in devDependencies`);
    assert.equal(installedVersion, expectedVersions[name], `${name} must be installed at the frozen SDK version`);
  }
  return expectedVersions;
}

function startDeterministicProvider() {
  const requests = [];
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
        response.writeHead(404).end();
        return;
      }

      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        response.writeHead(400).end("invalid JSON");
        return;
      }

      const featureRequest = body.messages?.some((message) => message.role === "system"
        && typeof message.content === "string" && message.content.includes(FEATURE_SYSTEM_PROMPT)) === true;
      requests.push({ featureRequest, model: body.model });
      const text = featureRequest
        ? GENERATED_HANDOFF
        : "Smoke conversation accepted; continue from the provided context.";
      const firstChunk = {
        id: "chatcmpl-pi-sdk-smoke",
        object: "chat.completion.chunk",
        created: 1,
        model: body.model,
        choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: null }],
      };
      const finalChunk = {
        id: "chatcmpl-pi-sdk-smoke",
        object: "chat.completion.chunk",
        created: 1,
        model: body.model,
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      };
      response.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "close",
      });
      response.end(`data: ${JSON.stringify(firstChunk)}\n\ndata: ${JSON.stringify(finalChunk)}\n\ndata: [DONE]\n\n`);
    });
  });

  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not start loopback-only deterministic provider"));
        return;
      }
      resolvePromise({ server, requests, baseUrl: `http://127.0.0.1:${address.port}/v1` });
    });
  });
}

function writeIsolatedModelConfig(baseUrl) {
  const model = {
    id: "smoke-model",
    name: "Pi SDK offline smoke model",
    contextWindow: 32_768,
    maxTokens: 1_024,
    input: ["text"],
    reasoning: false,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    compat: {
      supportsStore: false,
      supportsUsageInStreaming: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
    },
  };
  const config = {
    $schema: "https://pi.dev/schemas/models.schema.json",
    providers: {
      "pi-sdk-smoke": {
        baseUrl,
        api: "openai-completions",
        apiKey: "pi-sdk-smoke-only",
        models: [model],
      },
    },
  };
  writeFileSync(resolve(agentDir, "models.json"), `${JSON.stringify(config, null, 2)}\n`);
}

function rejectWaiters(waiters, error) {
  for (const waiter of waiters.splice(0)) waiter.reject(error);
}

async function runPiRpc({ flow, providerRequests }) {
  const child = spawn(process.execPath, [piCli, ...RPC_ARGS], {
    cwd: root,
    env,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  let lineBuffer = "";
  let closed = false;
  let timedOut = false;
  let processError;
  let closeResult;
  const records = [];
  const waiters = [];
  let resolveClose;
  const closePromise = new Promise((resolvePromise) => { resolveClose = resolvePromise; });
  let resolveDeadline;
  const deadlinePromise = new Promise((resolvePromise) => { resolveDeadline = resolvePromise; });

  function addRecord(record) {
    records.push(record);
    for (let index = waiters.length - 1; index >= 0; index -= 1) {
      const waiter = waiters[index];
      if (waiter.predicate(record)) {
        waiters.splice(index, 1);
        waiter.resolve(record);
      }
    }
  }

  function consumeLine(line) {
    const cleaned = line.replace(/\u001b\]52;c;[A-Za-z0-9+/=]*\u0007/g, "").trim();
    if (!cleaned) return;
    try {
      addRecord(JSON.parse(cleaned));
    } catch {
      // Non-protocol output is retained in evidence but is not treated as an RPC response.
    }
  }

  function waitFor(predicate, description) {
    const existing = records.find(predicate);
    if (existing) return Promise.resolve(existing);
    if (closed) return Promise.reject(new Error(`Pi exited before ${description}`));
    return new Promise((resolvePromise, reject) => waiters.push({ predicate, resolve: resolvePromise, reject }));
  }

  async function send(command, description) {
    const responsePromise = waitFor((record) => record.type === "response" && record.id === command.id, description);
    child.stdin.write(`${JSON.stringify(command)}\n`);
    return responsePromise;
  }

  const deadline = setTimeout(() => {
    timedOut = true;
    child.kill();
    resolveDeadline({ timedOut: true });
  }, PROBE_TIMEOUT_MS);

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString("utf8");
    stdout += text;
    lineBuffer += text;
    let newline;
    while ((newline = lineBuffer.indexOf("\n")) !== -1) {
      consumeLine(lineBuffer.slice(0, newline).replace(/\r$/, ""));
      lineBuffer = lineBuffer.slice(newline + 1);
    }
  });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
  child.once("error", (error) => {
    processError = error;
    rejectWaiters(waiters, error);
  });
  child.once("close", (code, signal) => {
    if (lineBuffer) consumeLine(lineBuffer);
    closeResult = { exitCode: code, signal };
    closed = true;
    clearTimeout(deadline);
    resolveClose(closeResult);
    rejectWaiters(waiters, new Error(`Pi exited before the expected RPC response (code=${code}, signal=${signal})`));
  });

  const state = { commands: null, promptResponse: null, notification: null, exitCode: null, signal: null };
  let flowError;
  try {
    const commandsResponse = await send({ id: "smoke-commands", type: "get_commands" }, "the extension command inventory");
    state.commands = commandsResponse.success === true ? commandsResponse.data?.commands ?? null : null;
    if (flow !== "extension_load" && flow !== "error_path") {
      const initialResponse = await send({ id: "smoke-context", type: "prompt", message: INITIAL_PROMPT }, "the initial prompt response");
      if (initialResponse.success !== true || initialResponse.data?.disposition !== "started") {
        throw new Error(`Initial prompt was not started: ${JSON.stringify(initialResponse)}`);
      }
      await waitFor((record) => record.type === "agent_end", "the initial actual Pi agent run to finish");

    }

    if (flow !== "extension_load") {
      const requestCountBeforeFeature = providerRequests.length;
      const featureResponsePromise = send({ id: "smoke-feature", type: "prompt", message: "/handoff:copy" }, "the handoff command response");
      const expectedMessage = flow === "error_path"
        ? "No conversation context available to hand off"
        : "Handoff prompt copied to clipboard";
      const notificationPromise = waitFor((record) => record.type === "extension_ui_request" && record.method === "notify"
        && typeof record.message === "string" && record.message.startsWith(expectedMessage), "the handoff feature notification");
      const [featureResponse, notification] = await Promise.all([featureResponsePromise, notificationPromise]);
      state.promptResponse = featureResponse;
      state.notification = notification;
      state.noFeatureCompletionRequest = flow !== "error_path"
        || providerRequests.slice(requestCountBeforeFeature).every((request) => request.featureRequest === false);
      state.featureRequestCount = providerRequests.slice(requestCountBeforeFeature).filter((request) => request.featureRequest).length;
    }
  } catch (error) {
    flowError = error instanceof Error ? error.message : String(error);
  } finally {
    if (!closed) child.stdin.end();
    const exit = await Promise.race([closePromise, deadlinePromise]);
    if (exit?.timedOut && !closed) {
      await Promise.race([closePromise, new Promise((resolvePromise) => setTimeout(resolvePromise, CLEANUP_GRACE_MS))]);
      if (!closed) child.kill("SIGKILL");
    }
    if (!closed) {
      await Promise.race([closePromise, new Promise((resolvePromise) => setTimeout(resolvePromise, CLEANUP_GRACE_MS))]);
    }
    clearTimeout(deadline);
  }

  state.exitCode = closeResult?.exitCode ?? null;
  state.signal = closeResult?.signal ?? null;
  state.timedOut = timedOut;
  state.processError = processError?.message;
  state.flowError = flowError;
  state.stdout = stdout;
  state.stderr = stderr;
  state.records = records;
  return state;
}

function powerShell(executable, script, input) {
  const encodedScript = Buffer.from(script, "utf16le").toString("base64");
  const result = spawnSync(executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-EncodedCommand", encodedScript], {
    encoding: "utf8",
    env,
    input,
    timeout: PROBE_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`PowerShell failed (${result.status ?? "no exit code"}): ${result.error?.message ?? result.stderr ?? ""}`);
  }
  return (result.stdout ?? "").trim().replace(/^\uFEFF/, "");
}

function getWindowsClipboardSnapshot(executable) {
  const output = powerShell(executable, [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.Windows.Forms",
    "$data = [System.Windows.Forms.Clipboard]::GetDataObject()",
    "$formats = if ($null -eq $data) { @() } else { @($data.GetFormats()) }",
    "$textPresent = [System.Windows.Forms.Clipboard]::ContainsText()",
    "$textBase64 = if ($textPresent) { [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([System.Windows.Forms.Clipboard]::GetText())) } else { $null }",
    "$supported = @('System.String', 'UnicodeText', 'Text', 'Locale', 'OEMText')",
    "$unsupported = @($formats | Where-Object { $supported -notcontains $_ })",
    "[PSCustomObject]@{ formats = $formats; textPresent = $textPresent; textBase64 = $textBase64; restorable = ($unsupported.Count -eq 0 -and ($formats.Count -eq 0 -or $textPresent)) } | ConvertTo-Json -Compress",
  ].join("\n"));
  let snapshot;
  try {
    snapshot = JSON.parse(output);
  } catch {
    throw new Error("Unable to parse the clipboard-state snapshot; clipboard content was not retained");
  }
  const formats = Array.isArray(snapshot.formats) ? snapshot.formats : snapshot.formats ? [snapshot.formats] : [];
  assert.equal(snapshot.restorable, true,
    "Refusing the Windows clipboard smoke because its current non-text formats cannot be restored safely");
  const text = snapshot.textBase64 ? Buffer.from(snapshot.textBase64, "base64").toString("utf8") : null;
  return { textPresent: snapshot.textPresent === true, text, formats };
}

function setWindowsClipboardText(executable, text) {
  const encodedText = Buffer.from(text, "utf8").toString("base64");
  powerShell(executable, [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.Windows.Forms",
    "$encoded = [Console]::In.ReadToEnd().Trim()",
    "$value = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))",
    "[System.Windows.Forms.Clipboard]::SetText($value, [System.Windows.Forms.TextDataFormat]::UnicodeText)",
  ].join("\n"), encodedText);
}

async function withVerifiedClipboard(run) {
  if (process.platform === "win32") {
    const executable = resolve(process.env.SystemRoot ?? "C:/Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
    const original = getWindowsClipboardSnapshot(executable);
    let verified = false;
    try {
      const result = await run();
      const copied = getWindowsClipboardSnapshot(executable);
      verified = copied.textPresent && copied.text === GENERATED_HANDOFF;
      return { result, clipboard: { channel: "Windows system clipboard", verified, text: copied.text ?? null } };
    } finally {
      if (original.textPresent) setWindowsClipboardText(executable, original.text);
      else powerShell(executable, "$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::Clear()");
      const restored = getWindowsClipboardSnapshot(executable);
      assert.equal(restored.textPresent, original.textPresent, "The original Windows clipboard text state must be restored");
      if (original.textPresent) assert.equal(restored.text, original.text, "The original Windows clipboard text must be restored");
      else assert.equal(restored.formats.length, 0, "The initially empty Windows clipboard must be restored");
    }
  }

  if (process.platform === "linux") {
    const result = await run();
    const payloads = parseOsc52Payloads(result.stdout);
    const copied = payloads.includes(GENERATED_HANDOFF);
    return { result, clipboard: { channel: "Pi OSC 52 headless clipboard boundary", verified: copied, text: copied ? GENERATED_HANDOFF : null } };
  }

  throw new Error(`The functional smoke supports Windows and Linux, not ${process.platform}`);
}

function runtimeFlags(result) {
  const output = `${result?.stdout ?? ""}\n${result?.stderr ?? ""}`;
  return {
    unhandled: UNHANDLED_ERROR_PATTERN.test(output),
    loadError: EXTENSION_LOAD_ERROR_PATTERN.test(output),
  };
}

function cleanEvidence(output, providerRequests) {
  return sanitizeLocalPaths(output, [agentDir, root])
    .replace(/\u001b\]52;c;[A-Za-z0-9+/=]*\u0007/g, "[captured Pi OSC 52 clipboard payload]")
    .concat(`\nProvider observations: ${JSON.stringify(providerRequests)}`)
    .slice(-12_000);
}

function makeCase(name, result, observed, providerRequests) {
  const flags = runtimeFlags(result);
  const assertions = behaviorAssertions(name, observed);
  const exitCode = result?.exitCode;
  const fullOutput = `${result?.stdout ?? ""}\n${result?.stderr ?? ""}`;
  const extensionLoadErrors = flags.loadError || (name === "extension_load" && !assertions.every((item) => item.passed));
  const passed = exitCode === 0 && result?.timedOut !== true && !result?.processError && !result?.flowError
    && !flags.unhandled && !flags.loadError && assertions.every((item) => item.passed);
  const output = `${fullOutput}${result?.flowError ? `\nHarness error: ${result.flowError}` : ""}`;
  const evidence = cleanEvidence(output, providerRequests);
  return {
    name,
    command: "npm run smoke:pi -- --record",
    exit_code: exitCode ?? 1,
    passed,
    evidence: evidence || (result?.processError ?? "No output captured"),
    assertions,
    hasUnhandledError: flags.unhandled,
    hasLoadError: extensionLoadErrors,
  };
}

function caseFailed(name, error) {
  const observed = name === "host_shell" ? { exitCode: null, output: String(error), expectedVersion: "1.2.0" } : {};
  return {
    name,
    command: "npm run smoke:pi -- --record",
    exit_code: 1,
    passed: false,
    evidence: `Harness error: ${error instanceof Error ? error.message : String(error)}`,
    assertions: behaviorAssertions(name, observed),
    hasUnhandledError: false,
    hasLoadError: name === "extension_load",
  };
}

async function closeProvider(server) {
  const closed = new Promise((resolvePromise) => server.close(resolvePromise));
  server.closeAllConnections();
  await Promise.race([closed, new Promise((resolvePromise) => setTimeout(resolvePromise, CLEANUP_GRACE_MS))]);
}

async function main() {
  const shouldRecord = process.argv.includes("--record");
  const sdkVersions = verifySdkPins();
  const provider = await startDeterministicProvider();
  const cases = [];
  writeIsolatedModelConfig(provider.baseUrl);
  try {
    let extensionLoadResult;
    try {
      extensionLoadResult = await runPiRpc({ flow: "extension_load", providerRequests: provider.requests });
      const observed = {
        commands: extensionLoadResult.commands,
        exitCode: extensionLoadResult.exitCode,
        runtimeErrors: runtimeFlags(extensionLoadResult).unhandled || runtimeFlags(extensionLoadResult).loadError,
      };
      cases.push(makeCase("extension_load", extensionLoadResult, observed, provider.requests));
    } catch (error) {
      cases.push(caseFailed("extension_load", error));
    }

    let happyRun;
    try {
      happyRun = await withVerifiedClipboard(() => runPiRpc({ flow: "happy_path", providerRequests: provider.requests }));
      const result = happyRun.result;
      cases.push(makeCase("happy_path", result, {
        promptResponse: result.promptResponse,
        notification: result.notification,
        clipboard: happyRun.clipboard,
      }, provider.requests));
    } catch (error) {
      cases.push(caseFailed("happy_path", error));
    }

    try {
      const result = await runPiRpc({ flow: "error_path", providerRequests: provider.requests });
      cases.push(makeCase("error_path", result, {
        promptResponse: result.promptResponse,
        notification: result.notification,
        noFeatureCompletionRequest: result.noFeatureCompletionRequest === true && result.featureRequestCount === 0,
      }, provider.requests));
    } catch (error) {
      cases.push(caseFailed("error_path", error));
    }

    try {
      const reloadedRun = await withVerifiedClipboard(() => runPiRpc({ flow: "reload_cleanup", providerRequests: provider.requests }));
      const result = reloadedRun.result;
      const errors = runtimeFlags(result);
      cases.push(makeCase("reload_cleanup", result, {
        commands: result.commands,
        promptResponse: result.promptResponse,
        notification: result.notification,
        clipboard: reloadedRun.clipboard,
        exitCode: result.exitCode,
        runtimeErrors: errors.unhandled || errors.loadError,
      }, provider.requests));
    } catch (error) {
      cases.push(caseFailed("reload_cleanup", error));
    }

    try {
      const expectedVersion = sdkVersions["@earendil-works/pi-coding-agent"];
      const executable = process.platform === "win32"
        ? resolve(process.env.SystemRoot ?? "C:/Windows", "System32/WindowsPowerShell/v1.0/powershell.exe")
        : "/bin/sh";
      const args = process.platform === "win32"
        ? ["-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-EncodedCommand",
          Buffer.from(`& '${process.execPath.replaceAll("'", "''")}' '${piCli.replaceAll("'", "''")}' --no-extensions --version; exit $LASTEXITCODE`, "utf16le").toString("base64")]
        : ["-c", '"$1" "$2" --no-extensions --version', "pi-sdk-smoke-host-shell", process.execPath, piCli];
      const shellResult = spawnSync(executable, args, {
        cwd: root,
        env,
        encoding: "utf8",
        timeout: PROBE_TIMEOUT_MS,
        windowsHide: true,
      });
      const output = `${shellResult.stdout ?? ""}${shellResult.stderr ?? ""}`.trim().replace(/^\uFEFF/, "");
      const result = { exitCode: shellResult.status, stdout: output, stderr: "", timedOut: shellResult.error?.code === "ETIMEDOUT",
        processError: shellResult.error?.message };
      cases.push(makeCase("host_shell", result, { exitCode: result.exitCode, output, expectedVersion }, provider.requests));
    } catch (error) {
      cases.push(caseFailed("host_shell", error));
    }
  } finally {
    await closeProvider(provider.server);
    rmSync(agentDir, { recursive: true, force: true });
  }

  const report = {
    schema_version: 1,
    verification_contract: VERIFICATION_CONTRACT,
    sdk_versions: sdkVersions,
    platform: process.platform,
    model_inference: "deterministic loopback OpenAI-compatible provider; no external inference",
    unhandled_errors: cases.filter((item) => item.hasUnhandledError).length,
    extension_load_errors: cases.filter((item) => item.hasLoadError).length,
    cases: cases.map(({ hasUnhandledError, hasLoadError, ...item }) => item),
  };
  const summary = {
    verification_contract: report.verification_contract,
    platform: report.platform,
    cases: report.cases.map((item) => ({ name: item.name, passed: item.passed, exit_code: item.exit_code })),
  };
  if (shouldRecord) {
    mkdirSync(resolve(root, "docs/verification"), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(summary));
  if (report.cases.some((item) => !item.passed)) process.exitCode = 1;
}

main().catch((error) => {
  rmSync(agentDir, { recursive: true, force: true });
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
