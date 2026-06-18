#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installClaudeCodeVsCodeHook } from "../src/adapters/claudeCodeSettingsInstaller.js";

try {
  const options = parseArgs(process.argv.slice(2), process.env);
  if (options.help) {
    usage();
    process.exit(0);
  }

  const result = await installClaudeCodeVsCodeHook(options);
  console.log(`Installed Agents in Watch Claude Code hook at ${result.settingsPath}`);
  console.log("Restart the Claude Code conversation in VS Code so it reloads settings.");
  process.exit(0);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

function parseArgs(args, env) {
  const options = {
    helperUrl: env.AGENTS_IN_WATCH_HELPER_URL ?? "http://127.0.0.1:42731",
    help: false,
    hookScriptPath: defaultHookScriptPath(),
    nodePath: process.execPath,
    projectDir: process.cwd(),
    token: env.AGENTS_IN_WATCH_TOKEN,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--helper-url") {
      options.helperUrl = readFlagValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--project") {
      options.projectDir = path.resolve(readFlagValue(args, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--token") {
      options.token = readFlagValue(args, index, arg);
      index += 1;
      continue;
    }

    throw new Error(`unknown option: ${arg}`);
  }

  return options;
}

function readFlagValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`missing value for ${flag}`);
  }
  return value;
}

function defaultHookScriptPath() {
  const currentFile = fileURLToPath(import.meta.url);
  return path.join(path.dirname(currentFile), "claude-code-hook.js");
}

function usage() {
  console.log(`Usage: node scripts/install-claude-vscode-hook.js [options]

Options:
  --project <path>      Project directory that VS Code opens (default: current directory)
  --helper-url <url>    Agents in Watch helper URL (default: http://127.0.0.1:42731)
  --token <token>       Pairing bearer token, if helper auth is enabled
  --help, -h            Show this help

Environment:
  AGENTS_IN_WATCH_HELPER_URL  Default helper URL
  AGENTS_IN_WATCH_TOKEN       Default bearer token
`);
}
