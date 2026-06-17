import path from "node:path";
import { normalizeAgentRequest } from "../shared/requestModel.js";

export function translateCodexDesktopHook(payload, options = {}) {
  const eventName = payload.event ?? payload.eventName;
  const computerName = options.computerName ?? "local-computer";
  const projectName = projectNameFromCwd(payload.cwd);
  const sessionId = payload.sessionId ?? payload.session_id ?? "unknown-session";

  if (eventName === "approval_request" || eventName === "approval-request") {
    const toolName = payload.toolName ?? payload.tool_name ?? "tool";
    const command = payload.command;
    const actionText = typeof command === "string" && command.trim() !== ""
      ? `run: ${command}`
      : `use ${toolName}`;
    const reason = payload.reason ?? "Codex Desktop is requesting approval.";

    return normalizeAgentRequest({
      agentType: "codex-desktop",
      projectName,
      computerName,
      sessionId,
      requestType: "approval",
      title: `Allow ${toolName}`,
      watchSummary: `Codex wants to ${actionText}`,
      phoneContext: [
        `Event: ${eventName}`,
        `Tool: ${toolName}`,
        command ? `Command: ${command}` : "",
        `Reason: ${reason}`,
      ]
        .filter(Boolean)
        .join("\n"),
      actions: ["allow", "deny", "pause"],
      riskLevel: riskLevelForApproval(payload),
    });
  }

  if (eventName === "notification") {
    const message = payload.message ?? "Codex Desktop needs attention.";

    return normalizeAgentRequest({
      agentType: "codex-desktop",
      projectName,
      computerName,
      sessionId,
      requestType: "notification",
      title: "Codex Desktop notification",
      watchSummary: message,
      phoneContext: `Event: ${eventName}\n${message}`,
      actions: ["open-phone", "pause"],
      riskLevel: "low",
    });
  }

  throw new Error(`unsupported Codex Desktop event: ${eventName}`);
}

function projectNameFromCwd(cwd) {
  if (typeof cwd !== "string" || cwd.trim() === "") {
    return "unknown-project";
  }

  return path.basename(cwd);
}

function riskLevelForApproval(payload) {
  const command = payload.command;

  if (typeof command !== "string") {
    return "medium";
  }

  if (/\brm\b|\bsudo\b|\bchmod\b|\bcurl\b.*\|\s*(sh|bash)/.test(command)) {
    return "high";
  }

  return "low";
}
