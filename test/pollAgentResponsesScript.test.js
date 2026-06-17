import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import test from "node:test";

test("poller prints matching responses as newline-delimited JSON", async () => {
  const requests = [];
  const fakeHelper = http.createServer(async (request, response) => {
    requests.push({ method: request.method, url: request.url, headers: request.headers });

    if (
      request.method === "GET" &&
      request.url === "/agent-responses?agentType=codex-desktop&sessionId=session-1"
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          responses: [
            {
              id: "response-outbox-1",
              requestId: "request-1",
              agentType: "codex-desktop",
              sessionId: "session-1",
              response: { requestId: "request-1", action: "allow", message: "" },
            },
            {
              id: "response-outbox-2",
              requestId: "request-2",
              agentType: "codex-desktop",
              sessionId: "session-1",
              response: { requestId: "request-2", action: "deny", message: "not now" },
            },
          ],
        })
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runPoller({
      args: ["--agent-type", "codex-desktop", "--session-id", "session-1"],
      env: { AGENTS_IN_WATCH_HELPER_URL: helperUrl },
    });

    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    const lines = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(lines.length, 2);
    assert.equal(lines[0].id, "response-outbox-1");
    assert.equal(lines[1].response.action, "deny");
    assert.equal(requests.length, 1);
  } finally {
    await close(fakeHelper);
  }
});

test("poller uses environment filters and bearer token", async () => {
  const requests = [];
  const fakeHelper = http.createServer(async (request, response) => {
    requests.push({ method: request.method, url: request.url, headers: request.headers });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ responses: [] }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runPoller({
      env: {
        AGENTS_IN_WATCH_HELPER_URL: helperUrl,
        AGENTS_IN_WATCH_TOKEN: "token-123",
        AGENTS_IN_WATCH_AGENT_TYPE: "claude-code",
        AGENTS_IN_WATCH_SESSION_ID: "session-2",
      },
    });

    assert.equal(result.code, 0);
    assert.equal(result.stdout, "");
    assert.equal(requests[0].url, "/agent-responses?agentType=claude-code&sessionId=session-2");
    assert.equal(requests[0].headers.authorization, "Bearer token-123");
  } finally {
    await close(fakeHelper);
  }
});

test("poller does not acknowledge responses without ack flag", async () => {
  const requests = [];
  const fakeHelper = http.createServer(async (request, response) => {
    requests.push({ method: request.method, url: request.url });

    if (request.method === "GET" && request.url === "/agent-responses") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ responses: [{ id: "response-outbox-1" }] }));
      return;
    }

    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "unexpected ack" }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runPoller({ env: { AGENTS_IN_WATCH_HELPER_URL: helperUrl } });

    assert.equal(result.code, 0);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, "GET");
  } finally {
    await close(fakeHelper);
  }
});

test("poller acknowledges each printed response with ack flag", async () => {
  const requests = [];
  const fakeHelper = http.createServer(async (request, response) => {
    requests.push({ method: request.method, url: request.url });

    if (request.method === "GET" && request.url === "/agent-responses") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          responses: [{ id: "response-outbox-1" }, { id: "response-outbox-2" }],
        })
      );
      return;
    }

    if (
      request.method === "POST" &&
      ["/agent-responses/response-outbox-1/ack", "/agent-responses/response-outbox-2/ack"].includes(
        request.url
      )
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runPoller({
      args: ["--ack"],
      env: { AGENTS_IN_WATCH_HELPER_URL: helperUrl },
    });

    assert.equal(result.code, 0);
    const lines = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(lines.length, 2);
    assert.equal(lines[0].id, "response-outbox-1");
    assert.equal(lines[1].id, "response-outbox-2");
    assert.deepEqual(
      requests.map((request) => `${request.method} ${request.url}`),
      [
        "GET /agent-responses",
        "POST /agent-responses/response-outbox-1/ack",
        "POST /agent-responses/response-outbox-2/ack",
      ]
    );
  } finally {
    await close(fakeHelper);
  }
});

test("poller reports ack rejection details", async () => {
  const fakeHelper = http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/agent-responses") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ responses: [{ id: "response-outbox-1" }] }));
      return;
    }

    if (request.method === "POST" && request.url === "/agent-responses/response-outbox-1/ack") {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "ack failed" }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runPoller({
      args: ["--ack"],
      env: { AGENTS_IN_WATCH_HELPER_URL: helperUrl },
    });

    assert.equal(result.code, 1);
    assert.match(result.stderr, /failed to acknowledge response response-outbox-1/);
    assert.match(result.stderr, /500/);
    assert.match(result.stderr, /ack failed/);
  } finally {
    await close(fakeHelper);
  }
});

test("poller reports helper rejection details", async () => {
  const fakeHelper = http.createServer(async (_request, response) => {
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "unauthorized" }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runPoller({ env: { AGENTS_IN_WATCH_HELPER_URL: helperUrl } });

    assert.equal(result.code, 1);
    assert.match(result.stderr, /failed to fetch agent responses/);
    assert.match(result.stderr, /401/);
    assert.match(result.stderr, /unauthorized/);
  } finally {
    await close(fakeHelper);
  }
});

test("poller reports invalid helper JSON", async () => {
  const fakeHelper = http.createServer(async (_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end("not-json");
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runPoller({ env: { AGENTS_IN_WATCH_HELPER_URL: helperUrl } });

    assert.equal(result.code, 1);
    assert.match(result.stderr, /failed to parse agent responses/);
  } finally {
    await close(fakeHelper);
  }
});

function runPoller({ args = [], env = {} } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/poll-agent-responses.js", ...args], {
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
