import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import test from "node:test";

test("smoke script creates a Claude Code request through the hook bridge", async () => {
  const receivedBodies = [];
  const fakeHelper = http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/status") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          ok: true,
          service: "agents-in-watch-helper",
          authRequired: true,
          requests: {
            pending: receivedBodies.length,
            resolved: 0,
            total: receivedBodies.length,
          },
        })
      );
      return;
    }

    if (request.method === "POST" && request.url === "/requests") {
      assert.equal(request.headers.authorization, "Bearer smoke-token");
      const chunks = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      receivedBodies.push(body);
      response.writeHead(201, { "content-type": "application/json" });
      response.end(JSON.stringify({ ...body, id: "request-1", status: "pending" }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runSmokeScript({
      env: {
        AGENTS_IN_WATCH_HELPER_URL: helperUrl,
        AGENTS_IN_WATCH_TOKEN: "smoke-token",
        COMPUTER_NAME: "work-mac",
      },
    });

    assert.equal(result.code, 0);
    assert.equal(receivedBodies.length, 1);
    assert.equal(receivedBodies[0].agentType, "claude-code");
    assert.equal(receivedBodies[0].requestType, "approval");
    assert.match(result.stdout, /Smoke request created/);
    assert.match(result.stdout, /Pending requests: 1/);
  } finally {
    await close(fakeHelper);
  }
});

function runSmokeScript({ env }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/smoke-claude-code.js"], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
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
