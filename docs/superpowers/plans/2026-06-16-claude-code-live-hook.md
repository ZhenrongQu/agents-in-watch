# Claude Code Live Hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Claude Code hook bridge usable with the helper's default bearer-token auth and document the exact Claude Code settings needed for a local live test.

**Architecture:** Keep Claude Code integration as a small command hook script that reads official Claude Code hook JSON from stdin, translates it into the shared request model, and posts it to the local Desktop Helper. Add token injection at the script boundary only; the request model and helper API remain unchanged.

**Tech Stack:** Node.js built-in test runner, Node.js `fetch`, Claude Code command hooks, local HTTP helper API.

---

## File Structure

- `scripts/claude-code-hook.js`: add optional `AGENTS_IN_WATCH_TOKEN` bearer auth header when posting translated requests.
- `test/claudeCodeHookScript.test.js`: cover authenticated posting and helper rejection output.
- `README.md`: document Claude Code project-local hook setup using `.claude/settings.local.json`, helper environment variables, and a copy/paste smoke test.

## References

- Claude Code hooks reference: `https://code.claude.com/docs/en/hooks`
- Relevant official facts: command hooks receive JSON on stdin; hook settings can live in `.claude/settings.local.json`; `PermissionRequest` and `Notification` are hook events; tool-event matchers match `tool_name`; notification matchers match `notification_type`.

---

### Task 1: Authenticated Hook Script

**Files:**
- Modify: `scripts/claude-code-hook.js`
- Modify: `test/claudeCodeHookScript.test.js`

- [ ] **Step 1: Write failing tests**

Add these tests to `test/claudeCodeHookScript.test.js` after the existing happy-path test:

```js
test("hook script includes bearer token when configured", async () => {
  const receivedHeaders = [];
  const fakeHelper = http.createServer(async (request, response) => {
    receivedHeaders.push(request.headers);
    for await (const _ of request) {
      // Drain request body.
    }
    response.writeHead(201, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runHookScript({
      env: {
        AGENTS_IN_WATCH_HELPER_URL: helperUrl,
        AGENTS_IN_WATCH_TOKEN: "token-123",
        COMPUTER_NAME: "work-mac",
      },
      input: JSON.stringify({
        hook_event_name: "Notification",
        session_id: "session-2",
        cwd: "/Users/me/projects/site",
        notification_type: "idle_prompt",
        message: "Claude is waiting for input.",
      }),
    });

    assert.equal(result.code, 0);
    assert.equal(receivedHeaders[0].authorization, "Bearer token-123");
  } finally {
    await close(fakeHelper);
  }
});

test("hook script reports helper rejection details", async () => {
  const fakeHelper = http.createServer(async (_request, response) => {
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "missing bearer token" }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runHookScript({
      env: { AGENTS_IN_WATCH_HELPER_URL: helperUrl, COMPUTER_NAME: "work-mac" },
      input: JSON.stringify({
        hook_event_name: "PermissionRequest",
        session_id: "session-1",
        cwd: "/Users/me/projects/payments-api",
        tool_name: "Bash",
        tool_input: { command: "pnpm test" },
      }),
    });

    assert.equal(result.code, 1);
    assert.match(result.stderr, /helper rejected request: 401/);
    assert.match(result.stderr, /missing bearer token/);
  } finally {
    await close(fakeHelper);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- test/claudeCodeHookScript.test.js
```

Expected: `hook script includes bearer token when configured` fails because `authorization` is missing.

- [ ] **Step 3: Add minimal token support**

Update `scripts/claude-code-hook.js` so the request headers are built before `fetch`:

```js
const headers = { "content-type": "application/json" };
const token = process.env.AGENTS_IN_WATCH_TOKEN;
if (token) {
  headers.authorization = `Bearer ${token}`;
}
```

Then pass `headers` into `fetch`.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- test/claudeCodeHookScript.test.js
```

Expected: all hook script tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/claude-code-hook.js test/claudeCodeHookScript.test.js
git commit -m "feat: authenticate Claude Code hook bridge"
```

---

### Task 2: Claude Code Setup Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Replace the short Claude Code Hook Bridge note with:

```markdown
## Claude Code Hook Bridge

The script `scripts/claude-code-hook.js` reads a Claude Code hook payload from stdin, translates it, and posts it to the helper. It supports Claude Code `PermissionRequest` and `Notification` events.

First pair a device and keep the helper token from the approval response:

```bash
export AGENTS_IN_WATCH_TOKEN=PASTE_TOKEN_HERE
export AGENTS_IN_WATCH_HELPER_URL=http://127.0.0.1:42731
export COMPUTER_NAME="$(hostname)"
```

For a project-local Claude Code setup, create `.claude/settings.local.json` in the project where you run Claude Code:

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/agents-in-watch/scripts/claude-code-hook.js"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/agents-in-watch/scripts/claude-code-hook.js"
          }
        ]
      }
    ]
  }
}
```

Claude Code sends hook JSON to command hooks on stdin. The bridge posts the translated request to the local helper using `AGENTS_IN_WATCH_TOKEN` as a bearer token. Keep this setup in `settings.local.json` unless you intentionally want to commit hook configuration to a project.

You can smoke-test the bridge without launching Claude Code:

```bash
printf '%s\n' '{
  "hook_event_name": "PermissionRequest",
  "session_id": "manual-smoke-test",
  "cwd": "'$PWD'",
  "tool_name": "Bash",
  "tool_input": { "command": "pnpm test" },
  "permission_request": { "reason": "Manual Agents in Watch smoke test." }
}' | scripts/claude-code-hook.js
```

If the command exits with `0`, open the iPhone app and refresh pending requests. The request should appear on the phone and then on the Watch when WatchConnectivity is ready.
```

- [ ] **Step 2: Run tests**

Run:

```bash
npm test
swift test
```

Expected: Node and Swift tests pass.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document Claude Code hook setup"
```

---

## Self-Review

- Spec coverage: this plan covers the recommended next step: a usable Claude Code hook bridge with bearer auth plus copy/paste setup docs for live local testing.
- Placeholder scan: no `TBD`, `TODO`, or unresolved implementation choices remain.
- Type consistency: environment names match the existing script style: `AGENTS_IN_WATCH_HELPER_URL`, `AGENTS_IN_WATCH_TOKEN`, and `COMPUTER_NAME`.
- Scope check: this plan does not implement Watch notifications, Codex desktop integration, installers, or background retry queues.
