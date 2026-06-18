import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildClaudeCodeHookCommand,
  installClaudeCodeVsCodeHook,
} from "../src/adapters/claudeCodeSettingsInstaller.js";

test("builds a VS Code-safe Claude Code hook command with inline environment", () => {
  assert.equal(
    buildClaudeCodeHookCommand({
      helperUrl: "http://127.0.0.1:42731",
      hookScriptPath: "/repo/scripts/claude-code-hook.js",
      token: "token with spaces",
    }),
    "/usr/bin/env AGENTS_IN_WATCH_WAIT_FOR_RESPONSE=1 AGENTS_IN_WATCH_OUTPUT_FORMAT=claude-code AGENTS_IN_WATCH_HELPER_URL=http://127.0.0.1:42731 AGENTS_IN_WATCH_TOKEN='token with spaces' node /repo/scripts/claude-code-hook.js"
  );
});

test("installs a PermissionRequest hook into project-local Claude settings", async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), "agents-in-watch-settings-"));

  const result = await installClaudeCodeVsCodeHook({
    helperUrl: "http://192.168.1.64:42731",
    hookScriptPath: "/repo/scripts/claude-code-hook.js",
    projectDir,
    token: "token-123",
  });

  const settings = JSON.parse(await readFile(result.settingsPath, "utf8"));
  assert.equal(result.created, true);
  assert.deepEqual(settings.hooks.PermissionRequest, [
    {
      matcher: "*",
      hooks: [
        {
          type: "command",
          command:
            "/usr/bin/env AGENTS_IN_WATCH_WAIT_FOR_RESPONSE=1 AGENTS_IN_WATCH_OUTPUT_FORMAT=claude-code AGENTS_IN_WATCH_HELPER_URL=http://192.168.1.64:42731 AGENTS_IN_WATCH_TOKEN=token-123 node /repo/scripts/claude-code-hook.js",
          timeout: 300,
        },
      ],
    },
  ]);
});

test("preserves existing Claude settings while replacing the Agents in Watch hook", async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), "agents-in-watch-settings-"));
  const settingsDir = path.join(projectDir, ".claude");
  const settingsPath = path.join(settingsDir, "settings.local.json");
  await mkdir(settingsDir, { recursive: true });
  await writeFile(
    settingsPath,
    JSON.stringify(
      {
        permissions: { defaultMode: "default" },
        hooks: {
          PermissionRequest: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "echo existing" }],
            },
            {
              matcher: "*",
              hooks: [
                {
                  type: "command",
                  command:
                    "/usr/bin/env AGENTS_IN_WATCH_WAIT_FOR_RESPONSE=1 AGENTS_IN_WATCH_OUTPUT_FORMAT=claude-code AGENTS_IN_WATCH_HELPER_URL=http://old node /repo/scripts/claude-code-hook.js",
                  timeout: 300,
                },
              ],
            },
          ],
        },
      },
      null,
      2
    )
  );

  await installClaudeCodeVsCodeHook({
    helperUrl: "http://127.0.0.1:42731",
    hookScriptPath: "/repo/scripts/claude-code-hook.js",
    projectDir,
  });

  const settings = JSON.parse(await readFile(settingsPath, "utf8"));
  assert.deepEqual(settings.permissions, { defaultMode: "default" });
  assert.equal(settings.hooks.PermissionRequest.length, 2);
  assert.equal(settings.hooks.PermissionRequest[0].matcher, "Bash");
  assert.match(settings.hooks.PermissionRequest[1].hooks[0].command, /AGENTS_IN_WATCH_HELPER_URL=http:\/\/127\.0\.0\.1:42731/);
});
