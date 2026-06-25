import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../src/helper/server.js";

test("creates, lists, and resolves requests over HTTP", async () => {
  const app = createServer();
  const baseUrl = await listen(app);

  try {
    const createResponse = await fetch(`${baseUrl}/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentType: "claude-code",
        projectName: "payments-api",
        computerName: "work-mac",
        sessionId: "session-1",
        requestType: "approval",
        title: "Allow command",
        watchSummary: "Claude wants to run pnpm test",
        phoneContext: "Command: pnpm test",
        actions: ["allow", "deny"],
        riskLevel: "low",
      }),
    });
    const created = await createResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(created.status, "pending");

    const listResponse = await fetch(`${baseUrl}/requests`);
    const pending = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(pending.requests.length, 1);
    assert.equal(pending.requests[0].id, created.id);

    const resolveResponse = await fetch(`${baseUrl}/requests/${created.id}/response`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "allow" }),
    });
    const resolved = await resolveResponse.json();

    assert.equal(resolveResponse.status, 200);
    assert.equal(resolved.status, "resolved");
    assert.equal(resolved.response.action, "allow");
  } finally {
    await close(app);
  }
});

test("returns 400 for invalid request payloads", async () => {
  const app = createServer();
  const baseUrl = await listen(app);

  try {
    const response = await fetch(`${baseUrl}/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /agentType is required/);
  } finally {
    await close(app);
  }
});

test("reports helper status and request counts", async () => {
  const app = createServer({ authRequired: true });
  const baseUrl = await listen(app);

  try {
    const statusBeforeResponse = await fetch(`${baseUrl}/status`);
    const statusBefore = await statusBeforeResponse.json();

    assert.equal(statusBeforeResponse.status, 200);
    assert.equal(statusBefore.ok, true);
    assert.equal(statusBefore.service, "agents-in-watch-helper");
    assert.equal(statusBefore.authRequired, true);
    assert.equal(statusBefore.requests.pending, 0);
    assert.equal(statusBefore.requests.resolved, 0);
    assert.equal(statusBefore.requests.total, 0);

    const sessionResponse = await fetch(`${baseUrl}/pairing/sessions`, { method: "POST" });
    const session = await sessionResponse.json();
    const claimResponse = await fetch(`${baseUrl}/pairing/claims`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: session.code, deviceName: "Smoke iPhone" }),
    });
    const claim = await claimResponse.json();
    const approveResponse = await fetch(`${baseUrl}/pairing/claims/${claim.id}/approve`, {
      method: "POST",
    });
    const approved = await approveResponse.json();

    const createResponse = await fetch(`${baseUrl}/requests`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${approved.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        agentType: "claude-code",
        projectName: "payments-api",
        computerName: "work-mac",
        sessionId: "session-1",
        requestType: "approval",
        title: "Allow command",
        watchSummary: "Claude wants to run pnpm test",
        phoneContext: "Command: pnpm test",
        actions: ["allow", "deny"],
        riskLevel: "low",
      }),
    });
    const created = await createResponse.json();

    const statusPendingResponse = await fetch(`${baseUrl}/status`);
    const statusPending = await statusPendingResponse.json();
    assert.equal(statusPending.requests.pending, 1);
    assert.equal(statusPending.requests.resolved, 0);
    assert.equal(statusPending.requests.total, 1);

    await fetch(`${baseUrl}/requests/${created.id}/response`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${approved.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: "allow" }),
    });

    const statusResolvedResponse = await fetch(`${baseUrl}/status`);
    const statusResolved = await statusResolvedResponse.json();
    assert.equal(statusResolved.requests.pending, 0);
    assert.equal(statusResolved.requests.resolved, 1);
    assert.equal(statusResolved.requests.total, 1);
  } finally {
    await close(app);
  }
});

test("serves a local pairing dashboard without request auth", async () => {
  const app = createServer({ authRequired: true });
  const baseUrl = await listen(app);

  try {
    const response = await fetch(`${baseUrl}/pairing`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/html/);
    assert.match(html, /Agents in Watch/);
    assert.match(html, /pairing-code/);
    assert.match(html, /helper-url/);
    assert.match(html, /\/pairing\/network/);
    assert.match(html, /\/pairing\/sessions/);
    assert.match(html, /\/pairing\/claims/);
    assert.match(html, /Pending Requests/);
    assert.match(html, /Agent Responses/);
    assert.match(html, /\/diagnostics/);
    assert.match(html, /\/diagnostics\/test-request/);
  } finally {
    await close(app);
  }
});

test("reports pairing network URLs without request auth", async () => {
  const app = createServer({
    authRequired: true,
    networkInterfaces: {
      en0: [
        {
          family: "IPv4",
          address: "192.168.1.64",
          internal: false,
        },
      ],
    },
  });
  const baseUrl = await listen(app);
  const port = new URL(baseUrl).port;

  try {
    const response = await fetch(`${baseUrl}/pairing/network`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.port, Number(port));
    assert.equal(body.urls[0], `http://192.168.1.64:${port}`);
  } finally {
    await close(app);
  }
});

test("pairs a device and uses its token for request APIs", async () => {
  const app = createServer({ authRequired: true });
  const baseUrl = await listen(app);

  try {
    const startResponse = await fetch(`${baseUrl}/pairing/sessions`, { method: "POST" });
    const session = await startResponse.json();
    assert.equal(startResponse.status, 201);
    assert.match(session.code, /^[0-9]{6}$/);

    const claimResponse = await fetch(`${baseUrl}/pairing/claims`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: session.code,
        deviceName: "Quinn's iPhone",
      }),
    });
    const claim = await claimResponse.json();
    assert.equal(claimResponse.status, 201);
    assert.equal(claim.status, "pending-approval");
    assert.equal(claim.token, undefined);

    const approveResponse = await fetch(`${baseUrl}/pairing/claims/${claim.id}/approve`, {
      method: "POST",
    });
    const approved = await approveResponse.json();
    assert.equal(approveResponse.status, 200);
    assert.equal(approved.status, "approved");
    assert.match(approved.token, /^[A-Za-z0-9_-]{43}$/);

    const createResponse = await fetch(`${baseUrl}/requests`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${approved.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        agentType: "claude-code",
        projectName: "payments-api",
        computerName: "work-mac",
        sessionId: "session-1",
        requestType: "approval",
        title: "Allow command",
        watchSummary: "Claude wants to run pnpm test",
        phoneContext: "Command: pnpm test",
        actions: ["allow", "deny"],
        riskLevel: "low",
      }),
    });
    const created = await createResponse.json();
    assert.equal(createResponse.status, 201);

    const listResponse = await fetch(`${baseUrl}/requests`, {
      headers: { authorization: `Bearer ${approved.token}` },
    });
    const pending = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.equal(pending.requests[0].id, created.id);
  } finally {
    await close(app);
  }
});

test("lists pending pairing claims for desktop approval", async () => {
  const app = createServer({ authRequired: true });
  const baseUrl = await listen(app);

  try {
    const startResponse = await fetch(`${baseUrl}/pairing/sessions`, { method: "POST" });
    const session = await startResponse.json();

    const claimResponse = await fetch(`${baseUrl}/pairing/claims`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: session.code,
        deviceName: "Zhenrong iPhone",
      }),
    });
    const claim = await claimResponse.json();

    const listResponse = await fetch(`${baseUrl}/pairing/claims`);
    const body = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(body.claims.length, 1);
    assert.equal(body.claims[0].id, claim.id);
    assert.equal(body.claims[0].deviceName, "Zhenrong iPhone");
    assert.equal(body.claims[0].status, "pending-approval");
    assert.equal(body.claims[0].token, undefined);
  } finally {
    await close(app);
  }
});

test("lists and acknowledges agent responses over HTTP", async () => {
  const app = createServer();
  const baseUrl = await listen(app);

  try {
    const firstCreateResponse = await fetch(`${baseUrl}/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentType: "claude-code",
        projectName: "payments-api",
        computerName: "work-mac",
        sessionId: "session-1",
        requestType: "approval",
        title: "Allow command",
        watchSummary: "Claude wants to run pnpm test",
        phoneContext: "Command: pnpm test",
        actions: ["allow", "deny"],
        riskLevel: "low",
      }),
    });
    const first = await firstCreateResponse.json();
    const secondCreateResponse = await fetch(`${baseUrl}/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentType: "codex-desktop",
        projectName: "site",
        computerName: "work-mac",
        sessionId: "session-2",
        requestType: "approval",
        title: "Allow shell",
        watchSummary: "Codex wants to run npm test",
        phoneContext: "Command: npm test",
        actions: ["allow", "deny"],
        riskLevel: "low",
      }),
    });
    const second = await secondCreateResponse.json();

    await fetch(`${baseUrl}/requests/${first.id}/response`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "allow" }),
    });
    await fetch(`${baseUrl}/requests/${second.id}/response`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "deny" }),
    });

    const listResponse = await fetch(`${baseUrl}/agent-responses?agentType=codex-desktop&sessionId=session-2`);
    const listed = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listed.responses.length, 1);
    assert.equal(listed.responses[0].requestId, second.id);
    assert.equal(listed.responses[0].response.action, "deny");

    const ackResponse = await fetch(`${baseUrl}/agent-responses/${listed.responses[0].id}/ack`, {
      method: "POST",
    });
    const acknowledged = await ackResponse.json();

    assert.equal(ackResponse.status, 200);
    assert.equal(acknowledged.id, listed.responses[0].id);
    assert.match(acknowledged.acknowledgedAt, /^\d{4}-\d{2}-\d{2}T/);

    const afterAckResponse = await fetch(`${baseUrl}/agent-responses?agentType=codex-desktop`);
    const afterAck = await afterAckResponse.json();
    assert.deepEqual(afterAck.responses, []);
  } finally {
    await close(app);
  }
});

test("reports control center diagnostics without request auth", async () => {
  const app = createServer();
  const baseUrl = await listen(app);

  try {
    const firstCreateResponse = await fetch(`${baseUrl}/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentType: "claude-code",
        projectName: "agents-in-watch",
        computerName: "work-mac",
        sessionId: "session-1",
        requestType: "approval",
        title: "Pending request",
        watchSummary: "Claude wants to run npm test",
        phoneContext: "Command: npm test",
        actions: ["allow", "deny"],
        riskLevel: "low",
      }),
    });
    const pending = await firstCreateResponse.json();

    const secondCreateResponse = await fetch(`${baseUrl}/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentType: "claude-code",
        projectName: "agents-in-watch",
        computerName: "work-mac",
        sessionId: "session-2",
        requestType: "approval",
        title: "Resolved request",
        watchSummary: "Claude wants to run swift test",
        phoneContext: "Command: swift test",
        actions: ["allow", "deny"],
        riskLevel: "low",
      }),
    });
    const resolved = await secondCreateResponse.json();

    await fetch(`${baseUrl}/requests/${resolved.id}/response`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "allow" }),
    });

    const response = await fetch(`${baseUrl}/diagnostics`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.summary.pending, 1);
    assert.equal(body.summary.resolved, 1);
    assert.equal(body.pendingRequests[0].id, pending.id);
    assert.equal(body.resolvedRequests[0].id, resolved.id);
    assert.equal(body.agentResponses[0].requestId, resolved.id);
    assert.equal(body.agentResponses[0].response.action, "allow");
  } finally {
    await close(app);
  }
});

test("creates a control center test request without request auth", async () => {
  const app = createServer({ authRequired: true });
  const baseUrl = await listen(app);

  try {
    const response = await fetch(`${baseUrl}/diagnostics/test-request`, {
      method: "POST",
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.title, "Control Center Test");
    assert.equal(body.status, "pending");
    assert.equal(body.actions.includes("allow"), true);

    const pendingResponse = await fetch(`${baseUrl}/requests`);
    const pending = await pendingResponse.json();
    assert.equal(pendingResponse.status, 401);
    assert.equal(pending.error, "missing bearer token");

    const diagnosticsResponse = await fetch(`${baseUrl}/diagnostics`);
    const diagnostics = await diagnosticsResponse.json();
    assert.equal(diagnostics.pendingRequests[0].id, body.id);
  } finally {
    await close(app);
  }
});

test("returns clear error for missing agent response acknowledgement", async () => {
  const app = createServer();
  const baseUrl = await listen(app);

  try {
    const response = await fetch(`${baseUrl}/agent-responses/missing-response/ack`, {
      method: "POST",
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "response not found");
  } finally {
    await close(app);
  }
});

test("protects agent response APIs when auth is required", async () => {
  const app = createServer({ authRequired: true });
  const baseUrl = await listen(app);

  try {
    const listResponse = await fetch(`${baseUrl}/agent-responses`);
    const listBody = await listResponse.json();
    const ackResponse = await fetch(`${baseUrl}/agent-responses/response-outbox-1/ack`, {
      method: "POST",
    });
    const ackBody = await ackResponse.json();

    assert.equal(listResponse.status, 401);
    assert.equal(listBody.error, "missing bearer token");
    assert.equal(ackResponse.status, 401);
    assert.equal(ackBody.error, "missing bearer token");
  } finally {
    await close(app);
  }
});

test("rejects request APIs without a bearer token when auth is required", async () => {
  const app = createServer({ authRequired: true });
  const baseUrl = await listen(app);

  try {
    const response = await fetch(`${baseUrl}/requests`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, "missing bearer token");
  } finally {
    await close(app);
  }
});

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
