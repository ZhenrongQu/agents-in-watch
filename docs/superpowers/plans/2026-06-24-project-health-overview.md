# Project Health Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a compact Control Center table of known projects and whether each project has the Claude Code hook installed.

**Architecture:** Add a read-only batch diagnostics endpoint that accepts explicit project paths and reuses `inspectClaudeCodeVsCodeHook`. Update the existing dashboard to render recent project paths from browser storage as a health table, with a refresh button and row click behavior that loads the selected project into the existing hook panel.

**Tech Stack:** Node.js ESM, built-in HTTP server, `node:test`, static Control Center HTML/JS.

---

### Task 1: Batch Hook Diagnostics API

**Files:**
- Modify: `src/helper/server.js`
- Test: `test/server.test.js`

- [x] **Step 1: Write failing tests**

Add a test for `POST /diagnostics/claude-hook/batch` with two temp projects: one installed and one missing. Assert it returns `projects.length === 2`, preserves input order, and reports `installed: true` / `false`.

- [x] **Step 2: Run test to verify failure**

Run: `node --test test/server.test.js`
Expected: FAIL with `404 !== 200` because the endpoint does not exist.

- [x] **Step 3: Implement minimal endpoint**

In `server.js`, add a read-only route before auth:
`POST /diagnostics/claude-hook/batch`
Read JSON `{ projectDirs: [...] }`, keep only non-empty strings, cap at 20 entries, inspect each project, and return `{ projects: [...] }`.

- [x] **Step 4: Run focused tests**

Run: `node --test test/server.test.js`
Expected: PASS.

### Task 2: Dashboard Project Health Table

**Files:**
- Modify: `src/helper/pairingDashboardPage.js`
- Test: `test/server.test.js`

- [x] **Step 1: Write failing dashboard assertions**

Extend the dashboard HTML test to require:
- `Project Health`
- `project-health`
- `Refresh Projects`
- `/diagnostics/claude-hook/batch`

- [x] **Step 2: Run test to verify failure**

Run: `node --test test/server.test.js`
Expected: FAIL because the dashboard does not yet include the table.

- [x] **Step 3: Implement minimal dashboard table**

Add a new section below the existing hook panel. Render recent projects from `localStorage`. Add `loadProjectHealth()` to call the batch endpoint, render rows with status, helper URL, and path, and let clicking a row set `project-path` and load detailed hook status.

- [x] **Step 4: Run focused and full tests**

Run: `node --test test/server.test.js`
Run: `npm test`
Expected: PASS.

### Task 3: Restart Helper, Verify, Commit

**Files:**
- Modify: `docs/superpowers/plans/2026-06-24-project-health-overview.md`

- [x] **Step 1: Restart helper**

Restart:
`AGENTS_IN_WATCH_HOST=0.0.0.0 AGENTS_IN_WATCH_AUTH_REQUIRED=0 npm start`

- [x] **Step 2: Verify live behavior**

Run:
`curl -sS -X POST http://127.0.0.1:42731/diagnostics/claude-hook/batch -H 'content-type: application/json' -d '{"projectDirs":["/Users/quzhenrong/rpas-lms","/Users/quzhenrong/Documents/agents-in-watch"]}'`

- [ ] **Step 3: Commit and push**

Run:
`git add ...`
`git commit -m "feat: add project health overview"`
`git push origin master`
