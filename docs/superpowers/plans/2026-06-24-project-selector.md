# Project Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Control Center inspect and install the Claude Code VS Code hook for any project path on this Mac.

**Architecture:** Reuse the existing hook inspector and installer. Add one local-only install endpoint that writes `.claude/settings.local.json`, and update the dashboard to accept a project path, remember recent paths in browser storage, inspect that path, and trigger install from the Mac browser.

**Tech Stack:** Node.js ESM, built-in HTTP server, `node:test`, static Control Center HTML/JS.

---

### Task 1: Local-Only Hook Install API

**Files:**
- Modify: `src/helper/server.js`
- Test: `test/server.test.js`

- [x] **Step 1: Write failing tests**

Add tests for `POST /diagnostics/claude-hook/install`:
- A loopback request installs a hook into a supplied `projectDir` and returns `installed: true`.
- A non-loopback request is rejected with `403`.

- [x] **Step 2: Run test to verify failure**

Run: `node --test test/server.test.js`
Expected: FAIL because `/diagnostics/claude-hook/install` does not exist.

- [x] **Step 3: Implement minimal API**

In `server.js`, import `installClaudeCodeVsCodeHook`, accept JSON `{ projectDir, helperUrl }`, require loopback remote address, write the hook using `process.execPath` and `scripts/claude-code-hook.js`, then return `inspectClaudeCodeVsCodeHook({ projectDir })`.

- [x] **Step 4: Run focused tests**

Run: `node --test test/server.test.js`
Expected: PASS.

### Task 2: Project Selector UI

**Files:**
- Modify: `src/helper/pairingDashboardPage.js`
- Test: `test/server.test.js`

- [x] **Step 1: Write failing dashboard assertions**

Extend the dashboard HTML test to require:
- `project-path`
- `project-recents`
- `Install Hook`
- `/diagnostics/claude-hook/install`

- [x] **Step 2: Run test to verify failure**

Run: `node --test test/server.test.js`
Expected: FAIL because the page does not contain the selector controls.

- [x] **Step 3: Implement minimal UI**

Add a project path input, recent-project dropdown backed by `localStorage`, “Check Hook” and “Install Hook” buttons. `loadClaudeHookStatus()` should call `/diagnostics/claude-hook?projectDir=...` when a path is provided. Install should POST to the local-only endpoint with the selected project and current helper URL.

- [x] **Step 4: Run focused and full tests**

Run: `node --test test/server.test.js`
Run: `npm test`
Expected: PASS.

### Task 3: Restart Helper, Verify, Commit

**Files:**
- Modify: `docs/superpowers/plans/2026-06-24-project-selector.md`

- [x] **Step 1: Restart helper**

Restart with:
`AGENTS_IN_WATCH_HOST=0.0.0.0 AGENTS_IN_WATCH_AUTH_REQUIRED=0 npm start`

- [x] **Step 2: Verify live behavior**

Run:
`curl -sS http://127.0.0.1:42731/diagnostics/claude-hook`

Run a local-only install smoke with a temp project:
`curl -sS -X POST http://127.0.0.1:42731/diagnostics/claude-hook/install -H 'content-type: application/json' -d '{"projectDir":"/tmp/...","helperUrl":"http://127.0.0.1:42731"}'`

- [ ] **Step 3: Commit and push**

Run:
`git add ...`
`git commit -m "feat: add project hook selector"`
`git push origin master`
