import { randomUUID } from "node:crypto";

const AGENT_TYPES = new Set(["claude-code", "codex-desktop"]);
const REQUEST_TYPES = new Set(["approval", "short-reply", "pause", "notification"]);
const ACTIONS = new Set(["allow", "deny", "pause", "reply", "open-phone"]);
const RISK_LEVELS = new Set(["low", "medium", "high"]);

export function normalizeAgentRequest(input) {
  const request = {
    id: input.id ?? randomUUID(),
    agentType: requiredString(input.agentType, "agentType"),
    projectName: requiredString(input.projectName, "projectName"),
    computerName: requiredString(input.computerName, "computerName"),
    sessionId: requiredString(input.sessionId, "sessionId"),
    requestType: requiredString(input.requestType, "requestType"),
    title: requiredString(input.title, "title"),
    watchSummary: requiredString(input.watchSummary, "watchSummary"),
    phoneContext: requiredString(input.phoneContext, "phoneContext"),
    actions: normalizeActions(input.actions),
    riskLevel: input.riskLevel ?? "low",
    status: input.status ?? "pending",
    createdAt: input.createdAt ?? new Date().toISOString(),
    expiresAt: input.expiresAt ?? null,
  };

  if (!AGENT_TYPES.has(request.agentType)) {
    throw new Error(`unsupported agentType: ${request.agentType}`);
  }

  if (!REQUEST_TYPES.has(request.requestType)) {
    throw new Error(`unsupported requestType: ${request.requestType}`);
  }

  if (!RISK_LEVELS.has(request.riskLevel)) {
    throw new Error(`unsupported riskLevel: ${request.riskLevel}`);
  }

  if (request.status !== "pending" && request.status !== "resolved") {
    throw new Error(`unsupported status: ${request.status}`);
  }

  if (isVagueWatchSummary(request.watchSummary)) {
    throw new Error("watchSummary must explain the requested action");
  }

  return request;
}

export function normalizeAgentResponse(input) {
  const requestId = requiredString(input.requestId, "requestId");
  const action = requiredString(input.action, "action");

  if (!ACTIONS.has(action)) {
    throw new Error(`unsupported action: ${action}`);
  }

  if (action === "reply") {
    return {
      requestId,
      action,
      message: requiredString(input.message, "message is required for reply"),
    };
  }

  return {
    requestId,
    action,
    message: input.message ? String(input.message) : "",
  };
}

function normalizeActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    throw new Error("actions must contain at least one action");
  }

  for (const action of actions) {
    if (!ACTIONS.has(action)) {
      throw new Error(`unsupported action: ${action}`);
    }
  }

  return [...new Set(actions)];
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required`);
  }

  return value.trim();
}

function isVagueWatchSummary(summary) {
  const normalized = summary.trim().toLowerCase();
  return normalized === "yes/no" || normalized === "allow?" || normalized === "approve?";
}
