import http from "node:http";
import { createPairingManager } from "./pairingManager.js";
import { createRequestStore } from "./requestStore.js";

export function createServer({
  store = createRequestStore(),
  pairing = createPairingManager(),
  authRequired = false,
} = {}) {
  return http.createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        return sendJson(response, 200, { ok: true });
      }

      if (request.method === "POST" && request.url === "/pairing/sessions") {
        return sendJson(response, 201, pairing.createSession());
      }

      if (request.method === "POST" && request.url === "/pairing/claims") {
        const body = await readJson(request);
        return sendJson(response, 201, pairing.claimSession(body));
      }

      const approveMatch = request.url.match(/^\/pairing\/claims\/([^/]+)\/approve$/);
      if (request.method === "POST" && approveMatch) {
        return sendJson(response, 200, pairing.approveClaim(approveMatch[1]));
      }

      const claimMatch = request.url.match(/^\/pairing\/claims\/([^/]+)$/);
      if (request.method === "GET" && claimMatch) {
        return sendJson(response, 200, pairing.getClaim(claimMatch[1]));
      }

      const auth = authenticateRequest(request, pairing, authRequired);
      if (!auth.ok) {
        return sendJson(response, 401, { error: auth.error });
      }

      if (request.method === "GET" && request.url === "/requests") {
        return sendJson(response, 200, { requests: store.listPending() });
      }

      if (request.method === "POST" && request.url === "/requests") {
        const body = await readJson(request);
        const created = store.add(body);
        return sendJson(response, 201, created);
      }

      const responseMatch = request.url.match(/^\/requests\/([^/]+)\/response$/);
      if (request.method === "POST" && responseMatch) {
        const body = await readJson(request);
        const resolved = store.resolve({
          requestId: responseMatch[1],
          ...body,
        });
        return sendJson(response, 200, resolved);
      }

      return sendJson(response, 404, { error: "not found" });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  });
}

function authenticateRequest(request, pairing, authRequired) {
  if (!authRequired) {
    return { ok: true };
  }

  const header = request.headers.authorization ?? "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    return { ok: false, error: "missing bearer token" };
  }

  try {
    return { ok: true, device: pairing.authenticate(match[1]) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function readJson(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.AGENTS_IN_WATCH_PORT ?? 42731);
  const host = process.env.AGENTS_IN_WATCH_HOST ?? "127.0.0.1";
  const authRequired = process.env.AGENTS_IN_WATCH_AUTH_REQUIRED !== "0";
  const server = createServer({ authRequired });

  server.listen(port, host, () => {
    console.log(`Agents in Watch helper listening on http://${host}:${port}`);
  });
}
