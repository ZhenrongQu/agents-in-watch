import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import test from "node:test";

test("Codex hook script posts translated requests to helper", async () => {
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
        event: "approval_request",
        sessionId: "session-1",
        cwd: "/Users/me/projects/payments-api",
        toolName: "shell",
        command: "npm test",
      }),
    });

    assert.equal(result.code, 0);
    assert.equal(receivedBodies.length, 1);
    assert.equal(receivedBodies[0].agentType, "codex-desktop");
    assert.equal(receivedBodies[0].watchSummary, "Codex wants to run: npm test");
  } finally {
    await close(fakeHelper);
  }
});

test("Codex hook script includes bearer token when configured", async () => {
  const receivedHeaders = [];
  const fakeHelper = http.createServer(async (request, response) => {
    receivedHeaders.push(request.headers);
    for await (const _ of request) {
      // Drain request body.
    }
    response.writeHead(201, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runHookScript({
      env: {
        AGENTS_IN_WATCH_HELPER_URL: helperUrl,
        AGENTS_IN_WATCH_TOKEN: "token-123",
        COMPUTER_NAME: "work-mac",
      },
      input: JSON.stringify({
        event: "notification",
        sessionId: "session-2",
        cwd: "/Users/me/projects/site",
        message: "Codex is waiting for input.",
      }),
    });

    assert.equal(result.code, 0);
    assert.equal(receivedHeaders[0].authorization, "Bearer token-123");
  } finally {
    await close(fakeHelper);
  }
});

test("Codex hook script can wait for and acknowledge a remote response", async () => {
  const requests = [];
  let stdout = "";
  const fakeHelper = http.createServer(async (request, response) => {
    requests.push({ method: request.method, url: request.url, headers: request.headers });
    const requestUrl = new URL(request.url, "http://helper.local");

    if (request.method === "POST" && requestUrl.pathname === "/requests") {
      for await (const _ of request) {
        // Drain request body.
      }
      response.writeHead(201, { "content-type": "application/json" });
      response.end(JSON.stringify({ id: "request-1" }));
      return;
    }

    if (
      request.method === "GET" &&
      requestUrl.pathname === "/agent-responses" &&
      requestUrl.searchParams.get("agentType") === "codex-desktop" &&
      requestUrl.searchParams.get("sessionId") === "session-1"
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          responses:
            requests.filter((item) => item.method === "GET").length < 2
              ? []
              : [
                  {
                    id: "response-outbox-1",
                    response: { requestId: "request-1", action: "reply", message: "继续" },
                  },
                ],
        })
      );
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/agent-responses/response-outbox-1/ack") {
      assert.deepEqual(parseJsonLines(stdout), [
        {
          id: "response-outbox-1",
          response: { requestId: "request-1", action: "reply", message: "继续" },
        },
      ]);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runHookScript({
      env: {
        AGENTS_IN_WATCH_HELPER_URL: helperUrl,
        AGENTS_IN_WATCH_TOKEN: "token-123",
        AGENTS_IN_WATCH_WAIT_FOR_RESPONSE: "1",
        AGENTS_IN_WATCH_POLL_INTERVAL_MS: "10",
        AGENTS_IN_WATCH_TIMEOUT_MS: "500",
        COMPUTER_NAME: "work-mac",
      },
      input: JSON.stringify({
        event: "approval_request",
        sessionId: "session-1",
        cwd: "/Users/me/projects/payments-api",
        toolName: "shell",
        command: "npm test",
      }),
      onStdout: (currentStdout) => {
        stdout = currentStdout;
      },
    });

    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.equal(parseJsonLines(result.stdout)[0].response.message, "继续");
    assert.deepEqual(
      requests.map((request) => `${request.method} ${new URL(request.url, "http://helper.local").pathname}`),
      [
        "POST /requests",
        "GET /agent-responses",
        "GET /agent-responses",
        "POST /agent-responses/response-outbox-1/ack",
      ]
    );
    assert.equal(requests[1].headers.authorization, "Bearer token-123");
  } finally {
    await close(fakeHelper);
  }
});

test("Codex hook script reports helper rejection details", async () => {
  const fakeHelper = http.createServer(async (_request, response) => {
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "missing bearer token" }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runHookScript({
      env: { AGENTS_IN_WATCH_HELPER_URL: helperUrl, COMPUTER_NAME: "work-mac" },
      input: JSON.stringify({
        event: "approval_request",
        sessionId: "session-1",
        cwd: "/Users/me/projects/payments-api",
        toolName: "shell",
        command: "npm test",
      }),
    });

    assert.equal(result.code, 1);
    assert.match(result.stderr, /helper rejected request: 401/);
    assert.match(result.stderr, /missing bearer token/);
  } finally {
    await close(fakeHelper);
  }
});

function runHookScript({ env, input, onStdout }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/codex-desktop-hook.js"], {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      onStdout?.(stdout);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

function parseJsonLines(stdout) {
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
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
