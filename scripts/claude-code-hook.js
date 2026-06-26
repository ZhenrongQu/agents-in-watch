#!/usr/bin/env node
import { translateClaudeCodeHook } from "../src/adapters/claudeCodeHook.js";
import {
  acknowledgeAgentResponse,
  formatHookResponseForOutput,
  postRequestAndMaybeWait,
  readRuntimeOptions,
} from "../src/adapters/hookRuntime.js";

const computerName = process.env.COMPUTER_NAME ?? "local-computer";

try {
  const payload = JSON.parse(await readStdin());
  const request = translateClaudeCodeHook(payload, { computerName });
  if (!request) {
    process.exit(0);
  }

  const runtimeOptions = readRuntimeOptions(process.env);
  const remoteResponse = await postRequestAndMaybeWait({
    ...runtimeOptions,
    request,
  });
  if (remoteResponse) {
    console.log(JSON.stringify(formatHookResponseForOutput(remoteResponse, {
      hookEventName: payload.hook_event_name ?? payload.hookEventName,
      outputFormat: runtimeOptions.outputFormat,
    })));
    await acknowledgeAgentResponse({
      helperUrl: runtimeOptions.helperUrl,
      responseId: remoteResponse.id,
      token: runtimeOptions.token,
    });
  }

  process.exit(0);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

async function readStdin() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}
