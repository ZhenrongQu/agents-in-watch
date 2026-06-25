import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const AGENTS_IN_WATCH_MARKER = "AGENTS_IN_WATCH_OUTPUT_FORMAT=claude-code";

export function buildClaudeCodeHookCommand({
  helperUrl,
  hookScriptPath,
  nodePath = "node",
  token,
}) {
  const parts = [
    "/usr/bin/env",
    "AGENTS_IN_WATCH_WAIT_FOR_RESPONSE=1",
    "AGENTS_IN_WATCH_OUTPUT_FORMAT=claude-code",
    `AGENTS_IN_WATCH_HELPER_URL=${shellQuote(helperUrl)}`,
  ];

  if (token) {
    parts.push(`AGENTS_IN_WATCH_TOKEN=${shellQuote(token)}`);
  }

  parts.push(shellQuote(nodePath), shellQuote(hookScriptPath));
  return parts.join(" ");
}

export async function installClaudeCodeVsCodeHook({
  helperUrl = "http://127.0.0.1:42731",
  hookScriptPath,
  nodePath = "node",
  projectDir = process.cwd(),
  token,
}) {
  const settingsDir = path.join(projectDir, ".claude");
  const settingsPath = path.join(settingsDir, "settings.local.json");
  await mkdir(settingsDir, { recursive: true });

  const { settings, created } = await readSettings(settingsPath);
  settings.hooks = settings.hooks && typeof settings.hooks === "object" ? settings.hooks : {};
  const existingPermissionHooks = Array.isArray(settings.hooks.PermissionRequest)
    ? settings.hooks.PermissionRequest
    : [];
  const command = buildClaudeCodeHookCommand({ helperUrl, hookScriptPath, nodePath, token });

  settings.hooks.PermissionRequest = [
    ...existingPermissionHooks.filter((entry) => !containsAgentsInWatchHook(entry)),
    {
      matcher: "*",
      hooks: [
        {
          type: "command",
          command,
          timeout: 300,
        },
      ],
    },
  ];

  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  return { created, settingsPath };
}

export async function inspectClaudeCodeVsCodeHook({
  projectDir = process.cwd(),
} = {}) {
  const settingsPath = path.join(projectDir, ".claude", "settings.local.json");
  const missing = {
    projectDir,
    settingsPath,
    exists: false,
    installed: false,
    helperUrl: null,
    waitForResponse: false,
    outputFormat: null,
    command: null,
  };

  const { settings, created } = await readSettings(settingsPath);
  if (created) {
    return missing;
  }

  const command = findAgentsInWatchHookCommand(settings);
  if (!command) {
    return { ...missing, exists: true };
  }

  return {
    projectDir,
    settingsPath,
    exists: true,
    installed: true,
    helperUrl: extractEnvValue(command, "AGENTS_IN_WATCH_HELPER_URL"),
    waitForResponse: extractEnvValue(command, "AGENTS_IN_WATCH_WAIT_FOR_RESPONSE") === "1",
    outputFormat: extractEnvValue(command, "AGENTS_IN_WATCH_OUTPUT_FORMAT"),
    command: redactHookCommand(command),
  };
}

async function readSettings(settingsPath) {
  try {
    return {
      created: false,
      settings: JSON.parse(await readFile(settingsPath, "utf8")),
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { created: true, settings: {} };
    }
    throw error;
  }
}

function containsAgentsInWatchHook(entry) {
  return Array.isArray(entry?.hooks) && entry.hooks.some((hook) => {
    return typeof hook?.command === "string" && hook.command.includes(AGENTS_IN_WATCH_MARKER);
  });
}

function findAgentsInWatchHookCommand(settings) {
  const permissionHooks = Array.isArray(settings?.hooks?.PermissionRequest)
    ? settings.hooks.PermissionRequest
    : [];

  for (const entry of permissionHooks) {
    for (const hook of entry?.hooks ?? []) {
      if (typeof hook?.command === "string" && hook.command.includes(AGENTS_IN_WATCH_MARKER)) {
        return hook.command;
      }
    }
  }

  return null;
}

function extractEnvValue(command, name) {
  const match = command.match(new RegExp(`${name}=('([^']*)'|"([^"]*)"|\\S+)`));
  if (!match) {
    return null;
  }
  return match[2] ?? match[3] ?? match[1];
}

function redactHookCommand(command) {
  return command.replace(/AGENTS_IN_WATCH_TOKEN=('([^']*)'|"([^"]*)"|\S+)/, "AGENTS_IN_WATCH_TOKEN=<redacted>");
}

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(text)) {
    return text;
  }
  return `'${text.replaceAll("'", "'\\''")}'`;
}
