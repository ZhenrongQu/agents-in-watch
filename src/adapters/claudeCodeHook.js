import path from "node:path";
import { normalizeAgentRequest } from "../shared/requestModel.js";

export function translateClaudeCodeHook(payload, options = {}) {
  const eventName = payload.hook_event_name ?? payload.hookEventName;
  const computerName = options.computerName ?? "local-computer";
  const projectName = projectNameFromCwd(payload.cwd);
  const sessionId = payload.session_id ?? payload.sessionId ?? "unknown-session";

  if (eventName === "PermissionRequest") {
    if (isAlreadyApprovedPermission(payload)) {
      return null;
    }

    const toolName = payload.tool_name ?? "tool";
    const command = payload.tool_input?.command;
    const actionText = command ? `run: ${command}` : `use ${toolName}`;
    const reason = payload.permission_request?.reason ?? "Claude Code is requesting permission.";

    return normalizeAgentRequest({
      agentType: "claude-code",
      projectName,
      computerName,
      sessionId,
      requestType: "approval",
      title: `Allow ${toolName}`,
      watchSummary: `Claude wants to ${actionText}`,
      phoneContext: [
        `Event: ${eventName}`,
        `Tool: ${toolName}`,
        command ? `Command: ${command}` : "",
        `Reason: ${reason}`,
      ]
        .filter(Boolean)
        .join("\n"),
      actions: ["allow", "deny", "pause"],
      riskLevel: riskLevelForPermission(payload),
    });
  }

  if (eventName === "Notification") {
    const message = payload.message ?? "Claude Code needs attention.";

    return normalizeAgentRequest({
      agentType: "claude-code",
      projectName,
      computerName,
      sessionId,
      requestType: "notification",
      title: "Claude Code notification",
      watchSummary: message,
      phoneContext: `Notification type: ${payload.notification_type ?? "unknown"}\n${message}`,
      actions: ["open-phone", "pause"],
      riskLevel: "low",
    });
  }

  throw new Error(`unsupported Claude Code hook event: ${eventName}`);
}

function isAlreadyApprovedPermission(payload) {
  const candidates = [
    payload.status,
    payload.decision,
    payload.permission_request?.status,
    payload.permission_request?.decision,
    payload.permission_request?.decision?.behavior,
  ];

  return candidates.some((value) => {
    if (typeof value !== "string") {
      return false;
    }

    return ["allow", "allowed", "approve", "approved", "auto-approved", "auto_approved"].includes(
      value.trim().toLowerCase()
    );
  });
}

function projectNameFromCwd(cwd) {
  if (typeof cwd !== "string" || cwd.trim() === "") {
    return "unknown-project";
  }

  return path.basename(cwd);
}

function riskLevelForPermission(payload) {
  const command = payload.tool_input?.command;

  if (typeof command !== "string") {
    return "medium";
  }

  if (/\brm\b|\bsudo\b|\bchmod\b|\bcurl\b.*\|\s*(sh|bash)/.test(command)) {
    return "high";
  }

  return "low";
}
