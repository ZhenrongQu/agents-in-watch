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
