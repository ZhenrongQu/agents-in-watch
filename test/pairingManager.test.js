import assert from "node:assert/strict";
import test from "node:test";
import { createPairingManager } from "../src/helper/pairingManager.js";

test("creates a pairing session with a human-readable code", () => {
  const manager = createPairingManager({
    now: () => new Date("2026-06-16T12:00:00.000Z"),
    ttlMs: 300000,
  });

  const session = manager.createSession();

  assert.match(session.id, /^[0-9a-f-]{36}$/);
  assert.match(session.code, /^[0-9]{6}$/);
  assert.equal(session.status, "open");
  assert.equal(session.expiresAt, "2026-06-16T12:05:00.000Z");
});

test("claims a pairing code and waits for desktop approval", () => {
  const manager = createPairingManager({
    now: () => new Date("2026-06-16T12:00:00.000Z"),
  });
  const session = manager.createSession();
  const claim = manager.claimSession({
    code: session.code,
    deviceName: "Quinn's iPhone",
  });

  assert.equal(claim.status, "pending-approval");
  assert.equal(claim.deviceName, "Quinn's iPhone");
  assert.equal(claim.token, undefined);
});

test("approves a pending claim and authenticates the issued token", () => {
  const manager = createPairingManager();
  const session = manager.createSession();
  const claim = manager.claimSession({
    code: session.code,
    deviceName: "Quinn's iPhone",
  });
  const approved = manager.approveClaim(claim.id);

  assert.equal(approved.status, "approved");
  assert.match(approved.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(manager.authenticate(approved.token).deviceName, "Quinn's iPhone");
});

test("rejects expired pairing codes", () => {
  let current = new Date("2026-06-16T12:00:00.000Z");
  const manager = createPairingManager({
    now: () => current,
    ttlMs: 1000,
  });
  const session = manager.createSession();
  current = new Date("2026-06-16T12:00:02.000Z");

  assert.throws(
    () => manager.claimSession({ code: session.code, deviceName: "Late iPhone" }),
    /pairing code expired/
  );
});

test("rejects unknown bearer tokens", () => {
  const manager = createPairingManager();

  assert.throws(() => manager.authenticate("bad-token"), /invalid token/);
});
