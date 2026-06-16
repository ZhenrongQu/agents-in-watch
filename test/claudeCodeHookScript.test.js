import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import test from "node:test";

test("hook script posts translated requests to helper", async () => {
  const receivedBodies = [];
  const fakeHelper = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    receivedBodies.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    response.writeHead(201, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runHookScript({
      env: { AGENTS_IN_WATCH_HELPER_URL: helperUrl, COMPUTER_NAME: "work-mac" },
      input: JSON.stringify({
        hook_event_name: "PermissionRequest",
        session_id: "session-1",
        cwd: "/Users/me/projects/payments-api",
        tool_name: "Bash",
        tool_input: { command: "pnpm test" },
      }),
    });

    assert.equal(result.code, 0);
    assert.equal(receivedBodies.length, 1);
    assert.equal(receivedBodies[0].agentType, "claude-code");
    assert.equal(receivedBodies[0].watchSummary, "Claude wants to run: pnpm test");
  } finally {
    await close(fakeHelper);
  }
});

function runHookScript({ env, input }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/claude-code-hook.js"], {
      env: { ...process.env, ...env },
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

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://${address.address}:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
