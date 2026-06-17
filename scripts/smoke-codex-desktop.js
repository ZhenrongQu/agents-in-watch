#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const helperUrl = process.env.AGENTS_IN_WATCH_HELPER_URL ?? "http://127.0.0.1:42731";
const hookScriptPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "codex-desktop-hook.js"
);

try {
  const before = await readStatus();
  const payload = {
    event: "approval_request",
    sessionId: "codex-smoke-test",
    cwd: process.cwd(),
    toolName: "shell",
    command: "npm test",
    reason: "Manual Agents in Watch Codex smoke test.",
  };

  const hookResult = await runHookScript(JSON.stringify(payload));
  if (hookResult.code !== 0) {
    throw new Error(`Codex hook bridge failed: ${hookResult.stderr || hookResult.stdout}`);
  }

  const after = await readStatus();
  console.log("Codex smoke request created.");
  console.log(`Helper: ${helperUrl}`);
  console.log(`Pending requests: ${after.requests.pending}`);
  console.log(`Total requests: ${after.requests.total}`);

  if (after.requests.total <= before.requests.total) {
    throw new Error("helper status did not show a new Codex request");
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

async function readStatus() {
  const response = await fetch(`${helperUrl}/status`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`helper status failed: ${response.status} ${body}`);
  }
  return response.json();
}

function runHookScript(input) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [hookScriptPath], {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}
