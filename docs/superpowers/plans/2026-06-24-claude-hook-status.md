# Claude Hook Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show whether the Claude Code VS Code hook is installed and pointed at the local helper from the Control Center.

**Architecture:** Add a small inspector to the existing Claude Code settings installer module, expose it through a helper diagnostics endpoint, and render the result in the existing `/pairing` dashboard. Keep this read-only and sanitize commands so local tokens are never displayed.

**Tech Stack:** Node.js ESM, `node:test`, built-in HTTP server, static Control Center HTML.

---

### Task 1: Add Hook Inspector

**Files:**
- Modify: `src/adapters/claudeCodeSettingsInstaller.js`
- Test: `test/claudeCodeSettingsInstaller.test.js`

- [x] **Step 1: Write failing tests**

Add tests that call `inspectClaudeCodeVsCodeHook()` for missing and installed settings, asserting installed status, helper URL extraction, wait mode, output format, and token redaction.

- [x] **Step 2: Run tests to verify failure**

Run: `node --test test/claudeCodeSettingsInstaller.test.js`
Expected: FAIL because `inspectClaudeCodeVsCodeHook` is not exported.

- [x] **Step 3: Implement minimal inspector**

Read `.claude/settings.local.json`, find a PermissionRequest hook containing `AGENTS_IN_WATCH_OUTPUT_FORMAT=claude-code`, extract relevant environment values with simple regex helpers, and redact `AGENTS_IN_WATCH_TOKEN`.

- [x] **Step 4: Run tests to verify pass**

Run: `node --test test/claudeCodeSettingsInstaller.test.js`
Expected: PASS.

### Task 2: Expose Dashboard Diagnostics

**Files:**
- Modify: `src/helper/server.js`
- Modify: `src/helper/pairingDashboardPage.js`
- Test: `test/server.test.js`

- [x] **Step 1: Write failing tests**

Add a server test for `GET /diagnostics/claude-hook?projectDir=...`, and extend the dashboard HTML test to require the new section and endpoint.

- [x] **Step 2: Run tests to verify failure**

Run: `node --test test/server.test.js`
Expected: FAIL because the endpoint and dashboard labels do not exist.

- [x] **Step 3: Implement endpoint and UI**

Import the inspector in `server.js`, add an unauthenticated read-only route, and add a “Claude Code Hook” panel to the dashboard with project path, installed status, helper URL, output format, wait mode, and sanitized command.

- [x] **Step 4: Run focused and full tests**

Run: `node --test test/claudeCodeSettingsInstaller.test.js test/server.test.js`
Run: `npm test`
Expected: PASS.

### Task 3: Restart Helper And Commit

**Files:**
- None beyond Tasks 1-2.

- [x] **Step 1: Restart local helper**

Stop the existing helper process and restart:
`AGENTS_IN_WATCH_HOST=0.0.0.0 AGENTS_IN_WATCH_AUTH_REQUIRED=0 npm start`

- [x] **Step 2: Verify live endpoint**

Run: `curl -sS http://127.0.0.1:42731/diagnostics/claude-hook`
Expected: JSON with `installed: true` for this repo.

- [ ] **Step 3: Commit and push**

Run: `git add ...`
Run: `git commit -m "feat: show Claude hook status"`
Run: `git push origin master`
