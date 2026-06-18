#!/usr/bin/env node
import { translateCodexDesktopHook } from "../src/adapters/codexDesktopHook.js";
import {
  acknowledgeAgentResponse,
  formatAgentHookResponse,
  postRequestAndMaybeWait,
  readRuntimeOptions,
} from "../src/adapters/hookRuntime.js";

const computerName = process.env.COMPUTER_NAME ?? "local-computer";

try {
  const payload = JSON.parse(await readStdin());
  const request = translateCodexDesktopHook(payload, { computerName });
  const runtimeOptions = readRuntimeOptions(process.env);
  const remoteResponse = await postRequestAndMaybeWait({
    ...runtimeOptions,
    request,
  });
  if (remoteResponse) {
    console.log(JSON.stringify(formatAgentHookResponse(remoteResponse)));
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
