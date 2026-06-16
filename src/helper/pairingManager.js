import { randomBytes, randomInt, randomUUID } from "node:crypto";

export function createPairingManager({ now = () => new Date(), ttlMs = 300000 } = {}) {
  const sessions = new Map();
  const claims = new Map();
  const devicesByToken = new Map();

  return {
    createSession() {
      const createdAt = now();
      const session = {
        id: randomUUID(),
        code: createCode(),
        status: "open",
        createdAt: createdAt.toISOString(),
        expiresAt: new Date(createdAt.getTime() + ttlMs).toISOString(),
      };
      sessions.set(session.id, session);
      return session;
    },

    claimSession({ code, deviceName }) {
      const session = findOpenSessionByCode(sessions, normalizeCode(code));
      if (!session) {
        throw new Error("pairing code not found");
      }

      if (Date.parse(session.expiresAt) <= now().getTime()) {
        session.status = "expired";
        throw new Error("pairing code expired");
      }

      const claim = {
        id: randomUUID(),
        pairingSessionId: session.id,
        deviceName: requiredString(deviceName, "deviceName"),
        status: "pending-approval",
        createdAt: now().toISOString(),
      };
      claims.set(claim.id, claim);
      return claim;
    },

    getClaim(id) {
      const claim = claims.get(id);
      if (!claim) {
        throw new Error("claim not found");
      }
      return claim;
    },

    approveClaim(id) {
      const claim = claims.get(id);
      if (!claim) {
        throw new Error("claim not found");
      }

      if (claim.status === "approved") {
        return claim;
      }

      const approved = {
        ...claim,
        status: "approved",
        approvedAt: now().toISOString(),
        deviceId: randomUUID(),
        token: randomBytes(32).toString("base64url"),
      };
      claims.set(id, approved);
      devicesByToken.set(approved.token, {
        deviceId: approved.deviceId,
        deviceName: approved.deviceName,
        approvedAt: approved.approvedAt,
      });
      return approved;
    },

    authenticate(token) {
      const device = devicesByToken.get(requiredString(token, "token"));
      if (!device) {
        throw new Error("invalid token");
      }
      return device;
    },
  };
}

function createCode() {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

function normalizeCode(code) {
  return requiredString(code, "code").replace(/\s+/g, "");
}

function findOpenSessionByCode(sessions, code) {
  return [...sessions.values()].find(
    (session) => session.code === code && session.status === "open"
  );
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}
