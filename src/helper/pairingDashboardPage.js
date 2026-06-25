export function renderPairingDashboardPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agents in Watch Pairing</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f6f7f8;
      --fg: #17191c;
      --muted: #606873;
      --panel: #ffffff;
      --line: #d9dee5;
      --accent: #0a7cff;
      --accent-fg: #ffffff;
      --ok: #147a3f;
      --warn: #9a5b00;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #111316;
        --fg: #f4f6f8;
        --muted: #a7b0bb;
        --panel: #1b1f24;
        --line: #343b45;
        --accent: #5aa2ff;
        --accent-fg: #07111f;
        --ok: #5bd083;
        --warn: #ffc05a;
      }
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--fg);
      font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }

    main {
      width: min(760px, calc(100vw - 32px));
      margin: 32px auto;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
    }

    h1, h2, p {
      margin: 0;
    }

    h1 {
      font-size: 24px;
      line-height: 1.15;
    }

    h2 {
      font-size: 16px;
      margin-bottom: 12px;
    }

    button {
      min-height: 36px;
      border: 1px solid var(--line);
      border-radius: 7px;
      background: var(--panel);
      color: var(--fg);
      padding: 0 12px;
      font: inherit;
      cursor: pointer;
    }

    button.primary {
      border-color: var(--accent);
      background: var(--accent);
      color: var(--accent-fg);
      font-weight: 650;
    }

    button:disabled {
      cursor: wait;
      opacity: 0.6;
    }

    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 16px;
    }

    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
    }

    .code {
      min-height: 78px;
      display: grid;
      place-items: center;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: color-mix(in srgb, var(--bg) 72%, var(--panel));
      font-size: 42px;
      font-weight: 760;
      font-variant-numeric: tabular-nums;
      line-height: 1;
      margin-bottom: 10px;
    }

    .helper-url {
      display: block;
      width: 100%;
      margin-bottom: 10px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: color-mix(in srgb, var(--bg) 72%, var(--panel));
      color: var(--fg);
      font: 18px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      overflow-x: auto;
      white-space: nowrap;
    }

    .meta, .empty, .status {
      color: var(--muted);
      font-size: 13px;
    }

    .status {
      margin-top: 10px;
      min-height: 20px;
    }

    .claim {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      padding: 10px 0;
      border-top: 1px solid var(--line);
    }

    .claim:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .claim-name {
      font-weight: 650;
      overflow-wrap: anywhere;
    }

    .claim-state {
      color: var(--warn);
      font-size: 13px;
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .metric {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: color-mix(in srgb, var(--bg) 72%, var(--panel));
    }

    .metric-value {
      font-size: 24px;
      font-weight: 760;
      line-height: 1;
    }

    .metric-label {
      color: var(--muted);
      font-size: 12px;
      margin-top: 6px;
    }

    .list {
      display: grid;
      gap: 10px;
    }

    .item {
      border-top: 1px solid var(--line);
      padding-top: 10px;
    }

    .item:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .item-title {
      font-weight: 650;
      overflow-wrap: anywhere;
    }

    .item-meta {
      color: var(--muted);
      font-size: 13px;
      overflow-wrap: anywhere;
    }

    .approved {
      color: var(--ok);
    }

    @media (max-width: 680px) {
      main {
        width: min(100vw - 20px, 760px);
        margin: 16px auto;
      }

      header, .grid {
        display: grid;
        grid-template-columns: 1fr;
      }

      .code {
        font-size: 36px;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Agents in Watch</h1>
      <button class="primary" id="new-code" type="button">New Pairing Code</button>
    </header>

    <div class="grid">
      <section>
        <h2>iPhone Server URL</h2>
        <code class="helper-url" id="helper-url">Loading...</code>
        <p class="meta" id="helper-url-meta">Use this URL in the iPhone app.</p>
      </section>

      <section>
        <h2>Pairing Code</h2>
        <div class="code" id="pairing-code">------</div>
        <p class="meta" id="pairing-meta">Starting...</p>
      </section>

      <section>
        <h2>Device Requests</h2>
        <div id="claims"><p class="empty">No device requests.</p></div>
        <p class="status" id="status" role="status"></p>
      </section>

      <section>
        <h2>Helper Status</h2>
        <div class="metrics">
          <div class="metric">
            <div class="metric-value" id="pending-count">0</div>
            <div class="metric-label">Pending</div>
          </div>
          <div class="metric">
            <div class="metric-value" id="resolved-count">0</div>
            <div class="metric-label">Resolved</div>
          </div>
          <div class="metric">
            <div class="metric-value" id="response-count">0</div>
            <div class="metric-label">Unacked</div>
          </div>
        </div>
        <p class="status" id="diagnostics-status" role="status">Loading diagnostics...</p>
        <button id="test-request" type="button">Create Test Request</button>
      </section>

      <section>
        <h2>Pending Requests</h2>
        <div class="list" id="pending-requests"><p class="empty">No pending requests.</p></div>
      </section>

      <section>
        <h2>Agent Responses</h2>
        <div class="list" id="agent-responses"><p class="empty">No unacknowledged responses.</p></div>
      </section>
    </div>
  </main>

  <script>
    const codeEl = document.querySelector("#pairing-code");
    const metaEl = document.querySelector("#pairing-meta");
    const helperUrlEl = document.querySelector("#helper-url");
    const helperUrlMetaEl = document.querySelector("#helper-url-meta");
    const claimsEl = document.querySelector("#claims");
    const statusEl = document.querySelector("#status");
    const newCodeButton = document.querySelector("#new-code");
    const pendingCountEl = document.querySelector("#pending-count");
    const resolvedCountEl = document.querySelector("#resolved-count");
    const responseCountEl = document.querySelector("#response-count");
    const diagnosticsStatusEl = document.querySelector("#diagnostics-status");
    const pendingRequestsEl = document.querySelector("#pending-requests");
    const agentResponsesEl = document.querySelector("#agent-responses");
    const testRequestButton = document.querySelector("#test-request");

    async function requestJson(path, options = {}) {
      const response = await fetch(path, {
        ...options,
        headers: {
          "content-type": "application/json",
          ...(options.headers ?? {})
        }
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Request failed");
      }
      return body;
    }

    function setStatus(message, className = "") {
      statusEl.textContent = message;
      statusEl.className = className ? "status " + className : "status";
    }

    function setDiagnosticsStatus(message, className = "") {
      diagnosticsStatusEl.textContent = message;
      diagnosticsStatusEl.className = className ? "status " + className : "status";
    }

    async function loadNetworkInfo() {
      try {
        const body = await requestJson("/pairing/network");
        const urls = body.urls ?? [];
        helperUrlEl.textContent = urls[0] ?? window.location.origin;
        helperUrlMetaEl.textContent = body.port ? "Port " + body.port : "Use this URL in the iPhone app.";
      } catch (error) {
        helperUrlEl.textContent = window.location.origin;
        helperUrlMetaEl.textContent = error.message;
      }
    }

    async function startPairing() {
      newCodeButton.disabled = true;
      try {
        const session = await requestJson("/pairing/sessions", { method: "POST" });
        codeEl.textContent = session.code;
        metaEl.textContent = "Expires " + new Date(session.expiresAt).toLocaleTimeString();
        setStatus("Pairing code ready.", "approved");
      } catch (error) {
        setStatus(error.message);
      } finally {
        newCodeButton.disabled = false;
      }
    }

    async function loadClaims() {
      try {
        const body = await requestJson("/pairing/claims");
        renderClaims(body.claims ?? []);
      } catch (error) {
        setStatus(error.message);
      }
    }

    function renderClaims(claims) {
      if (claims.length === 0) {
        claimsEl.innerHTML = '<p class="empty">No device requests.</p>';
        return;
      }

      claimsEl.replaceChildren(...claims.map((claim) => {
        const row = document.createElement("div");
        row.className = "claim";

        const copy = document.createElement("div");
        const name = document.createElement("div");
        name.className = "claim-name";
        name.textContent = claim.deviceName || "Unnamed device";
        const state = document.createElement("div");
        state.className = "claim-state";
        state.textContent = claim.status;
        copy.append(name, state);

        const approve = document.createElement("button");
        approve.type = "button";
        approve.textContent = "Approve";
        approve.addEventListener("click", () => approveClaim(claim.id, approve));

        row.append(copy, approve);
        return row;
      }));
    }

    async function approveClaim(id, button) {
      button.disabled = true;
      try {
        await requestJson("/pairing/claims/" + encodeURIComponent(id) + "/approve", { method: "POST" });
        setStatus("Device approved.", "approved");
        await loadClaims();
      } catch (error) {
        setStatus(error.message);
      } finally {
        button.disabled = false;
      }
    }

    async function loadDiagnostics() {
      try {
        const body = await requestJson("/diagnostics");
        renderDiagnostics(body);
        setDiagnosticsStatus("Updated " + new Date().toLocaleTimeString(), "approved");
      } catch (error) {
        setDiagnosticsStatus(error.message);
      }
    }

    function renderDiagnostics(body) {
      pendingCountEl.textContent = body.summary?.pending ?? 0;
      resolvedCountEl.textContent = body.summary?.resolved ?? 0;
      responseCountEl.textContent = (body.agentResponses ?? []).length;
      renderRequestList(pendingRequestsEl, body.pendingRequests ?? [], "No pending requests.");
      renderResponseList(agentResponsesEl, body.agentResponses ?? []);
    }

    function renderRequestList(container, requests, emptyMessage) {
      if (requests.length === 0) {
        container.innerHTML = '<p class="empty">' + emptyMessage + '</p>';
        return;
      }

      container.replaceChildren(...requests.slice(0, 8).map((request) => {
        const item = document.createElement("div");
        item.className = "item";
        const title = document.createElement("div");
        title.className = "item-title";
        title.textContent = request.title;
        const meta = document.createElement("div");
        meta.className = "item-meta";
        meta.textContent = request.agentType + " · " + request.sessionId;
        item.append(title, meta);
        return item;
      }));
    }

    function renderResponseList(container, responses) {
      if (responses.length === 0) {
        container.innerHTML = '<p class="empty">No unacknowledged responses.</p>';
        return;
      }

      container.replaceChildren(...responses.slice(0, 8).map((response) => {
        const item = document.createElement("div");
        item.className = "item";
        const title = document.createElement("div");
        title.className = "item-title";
        title.textContent = response.title;
        const meta = document.createElement("div");
        meta.className = "item-meta";
        meta.textContent = response.response.action + " · " + response.agentType + " · " + response.sessionId;
        item.append(title, meta);
        return item;
      }));
    }

    async function createTestRequest() {
      testRequestButton.disabled = true;
      try {
        await requestJson("/diagnostics/test-request", { method: "POST" });
        setDiagnosticsStatus("Test request created.", "approved");
        await loadDiagnostics();
      } catch (error) {
        setDiagnosticsStatus(error.message);
      } finally {
        testRequestButton.disabled = false;
      }
    }

    newCodeButton.addEventListener("click", startPairing);
    testRequestButton.addEventListener("click", createTestRequest);
    loadNetworkInfo();
    startPairing();
    loadClaims();
    loadDiagnostics();
    setInterval(loadClaims, 2000);
    setInterval(loadDiagnostics, 2000);
  </script>
</body>
</html>`;
}
