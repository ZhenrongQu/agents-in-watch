# Control Center v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `/pairing` into a small Control Center that shows helper health, pending requests, unresolved agent responses, and can create a manual test request.

**Architecture:** Keep the existing local HTTP helper and static pairing dashboard. Add one unauthenticated diagnostic endpoint for dashboard-only observability, plus one unauthenticated manual test endpoint for local development. Reuse `requestStore` as the source of truth.

**Tech Stack:** Node.js HTTP server, plain JavaScript, built-in `node:test`, static HTML/CSS/JS.

---

### Task 1: Expose Helper Diagnostics

**Files:**
- Modify: `src/helper/requestStore.js`
- Modify: `src/helper/server.js`
- Test: `test/server.test.js`

- [ ] **Step 1: Write failing server test**

Add a test to `test/server.test.js` that creates two requests, resolves one, and asserts `GET /diagnostics` returns `summary`, `pendingRequests`, and `agentResponses`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/server.test.js`

Expected: FAIL because `/diagnostics` does not exist.

- [ ] **Step 3: Add request store diagnostic helpers**

Add `listResolved(limit = 10)` and `diagnostics()` to `src/helper/requestStore.js`. `diagnostics()` should return summary, newest pending requests, newest resolved requests, and unacknowledged agent responses.

- [ ] **Step 4: Add `/diagnostics` route**

In `src/helper/server.js`, add `GET /diagnostics` before request auth. It returns `store.diagnostics()`.

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/server.test.js`

Expected: PASS.

### Task 2: Add Manual Test Request Endpoint

**Files:**
- Modify: `src/helper/server.js`
- Test: `test/server.test.js`

- [ ] **Step 1: Write failing server test**

Add a test that posts `POST /diagnostics/test-request` and asserts it creates a pending request with title `Control Center Test`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/server.test.js`

Expected: FAIL because `/diagnostics/test-request` does not exist.

- [ ] **Step 3: Add route**

In `src/helper/server.js`, add `POST /diagnostics/test-request` before request auth. It calls `store.add()` with a low-risk Claude Code approval request and returns 201.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/server.test.js`

Expected: PASS.

### Task 3: Render Control Center Sections

**Files:**
- Modify: `src/helper/pairingDashboardPage.js`
- Test: `test/server.test.js`

- [ ] **Step 1: Write failing dashboard HTML test**

Update the existing dashboard test to assert the HTML contains `/diagnostics`, `/diagnostics/test-request`, `Pending Requests`, and `Agent Responses`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/server.test.js`

Expected: FAIL because the dashboard lacks these labels/endpoints.

- [ ] **Step 3: Add dashboard UI**

Modify `src/helper/pairingDashboardPage.js` to add:
- Helper status section
- Pending Requests section
- Agent Responses section
- Create Test Request button
- JavaScript polling `/diagnostics` every 2 seconds

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/server.test.js`

Expected: PASS.

### Task 4: Verify and Commit

**Files:**
- All changed files

- [ ] **Step 1: Run full tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Commit**

Run:

```bash
git add docs/superpowers/plans/2026-06-24-control-center-v1.md src/helper/requestStore.js src/helper/server.js src/helper/pairingDashboardPage.js test/server.test.js
git commit -m "feat: add helper control center diagnostics"
```

- [ ] **Step 3: Push**

Run: `git push origin master`
