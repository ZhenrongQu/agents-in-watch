import http from "node:http";
import path from "node:path";
import {
  inspectClaudeCodeVsCodeHook,
  installClaudeCodeVsCodeHook,
} from "../adapters/claudeCodeSettingsInstaller.js";
import { getPairingNetworkInfo } from "./networkInfo.js";
import { createPairingManager } from "./pairingManager.js";
import { renderPairingDashboardPage } from "./pairingDashboardPage.js";
import { createRequestStore } from "./requestStore.js";

export function createServer({
  store = createRequestStore(),
  pairing = createPairingManager(),
  authRequired = false,
  networkInterfaces,
  projectDir = process.cwd(),
  hookScriptPath = path.join(process.cwd(), "scripts", "claude-code-hook.js"),
  isLoopbackRequest = isRequestFromLoopback,
  nodePath = process.execPath,
} = {}) {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");

      if (request.method === "GET" && request.url === "/health") {
        return sendJson(response, 200, { ok: true });
      }

      if (request.method === "GET" && request.url === "/status") {
        return sendJson(response, 200, {
          ok: true,
          service: "agents-in-watch-helper",
          authRequired,
          requests: store.summary(),
        });
      }

      if (request.method === "GET" && request.url === "/pairing") {
        return sendHtml(response, 200, renderPairingDashboardPage());
      }

      if (request.method === "GET" && request.url === "/pairing/network") {
        return sendJson(response, 200, getPairingNetworkInfo({
          hostHeader: request.headers.host ?? "",
          interfaces: networkInterfaces,
        }));
      }

      if (request.method === "GET" && request.url === "/diagnostics") {
        return sendJson(response, 200, store.diagnostics());
      }

      if (request.method === "GET" && url.pathname === "/diagnostics/claude-hook") {
        return sendJson(response, 200, await inspectClaudeCodeVsCodeHook({
          projectDir: url.searchParams.get("projectDir") ?? projectDir,
        }));
      }

      if (request.method === "POST" && url.pathname === "/diagnostics/claude-hook/batch") {
        const body = await readJson(request);
        const projectDirs = Array.isArray(body.projectDirs)
          ? body.projectDirs.filter((item) => typeof item === "string" && item.trim()).slice(0, 20)
          : [];
        return sendJson(response, 200, {
          projects: await Promise.all(projectDirs.map((targetProjectDir) => {
            return inspectClaudeCodeVsCodeHook({ projectDir: targetProjectDir });
          })),
        });
      }

      if (request.method === "POST" && url.pathname === "/diagnostics/claude-hook/install") {
        if (!isLoopbackRequest(request)) {
          return sendJson(response, 403, { error: "hook install is only available from this Mac" });
        }

        const body = await readJson(request);
        const targetProjectDir = body.projectDir ?? projectDir;
        await installClaudeCodeVsCodeHook({
          helperUrl: body.helperUrl ?? "http://127.0.0.1:42731",
          hookScriptPath,
          nodePath,
          projectDir: targetProjectDir,
        });
        return sendJson(response, 200, await inspectClaudeCodeVsCodeHook({
          projectDir: targetProjectDir,
        }));
      }

      if (request.method === "POST" && request.url === "/diagnostics/test-request") {
        const created = store.add({
          agentType: "claude-code",
          projectName: "agents-in-watch",
          computerName: "control-center",
          sessionId: `control-center-${Date.now()}`,
          requestType: "approval",
          title: "Control Center Test",
          watchSummary: "Claude wants to verify the iPhone and Watch connection",
          phoneContext: "Manual test request created from the Agents in Watch Control Center.",
          actions: ["allow", "deny", "pause"],
          riskLevel: "low",
        });
        return sendJson(response, 201, created);
      }

      if (request.method === "POST" && request.url === "/pairing/sessions") {
        return sendJson(response, 201, pairing.createSession());
      }

      if (request.method === "POST" && request.url === "/pairing/claims") {
        const body = await readJson(request);
        return sendJson(response, 201, pairing.claimSession(body));
      }

      if (request.method === "GET" && request.url === "/pairing/claims") {
        return sendJson(response, 200, { claims: pairing.listClaims() });
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

      if (request.method === "GET" && request.url.startsWith("/agent-responses")) {
        const url = new URL(request.url, "http://localhost");
        return sendJson(response, 200, {
          responses: store.listAgentResponses({
            agentType: url.searchParams.get("agentType") ?? "",
            sessionId: url.searchParams.get("sessionId") ?? "",
          }),
        });
      }

      const agentResponseAckMatch = request.url.match(/^\/agent-responses\/([^/]+)\/ack$/);
      if (request.method === "POST" && agentResponseAckMatch) {
        return sendJson(response, 200, store.ackAgentResponse(agentResponseAckMatch[1]));
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

function sendHtml(response, statusCode, html) {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
  });
  response.end(html);
}

function isRequestFromLoopback(request) {
  const address = request.socket.remoteAddress;
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
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
