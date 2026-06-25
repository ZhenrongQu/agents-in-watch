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

    input, select {
      min-height: 36px;
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 7px;
      background: var(--panel);
      color: var(--fg);
      padding: 0 10px;
      font: inherit;
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

    .hook-details {
      display: grid;
      gap: 8px;
    }

    .project-controls {
      display: grid;
      gap: 10px;
      margin-bottom: 12px;
    }

    .button-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .hook-row {
      display: grid;
      grid-template-columns: 120px minmax(0, 1fr);
      gap: 10px;
      font-size: 13px;
    }

    .hook-label {
      color: var(--muted);
    }

    .hook-value {
      overflow-wrap: anywhere;
    }

    .hook-command {
      margin-top: 10px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: color-mix(in srgb, var(--bg) 72%, var(--panel));
      font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      overflow-wrap: anywhere;
    }

    .project-health {
      display: grid;
      gap: 10px;
    }

    .health-row {
      display: grid;
      grid-template-columns: 78px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
      border-top: 1px solid var(--line);
      padding-top: 10px;
      cursor: pointer;
    }

    .health-row:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .health-status {
      font-weight: 700;
      font-size: 13px;
    }

    .health-status.off {
      color: var(--warn);
    }

    .health-path {
      font-weight: 650;
      overflow-wrap: anywhere;
    }

    .health-meta {
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
        <h2>Claude Code Hook</h2>
        <div class="project-controls">
          <input id="project-path" type="text" placeholder="/Users/you/path/to/project" autocomplete="off">
          <select id="project-recents" aria-label="Recent projects">
            <option value="">Recent projects</option>
          </select>
          <div class="button-row">
            <button id="check-hook" type="button">Check Hook</button>
            <button id="install-hook" class="primary" type="button">Install Hook</button>
          </div>
        </div>
        <div class="hook-details" id="claude-hook-details">
          <p class="empty">Loading hook status...</p>
        </div>
        <p class="status" id="claude-hook-status" role="status"></p>
      </section>

      <section>
        <h2>Pending Requests</h2>
        <div class="list" id="pending-requests"><p class="empty">No pending requests.</p></div>
      </section>

      <section>
        <h2>Project Health</h2>
        <div class="button-row">
          <button id="refresh-projects" type="button">Refresh Projects</button>
        </div>
        <div class="project-health" id="project-health">
          <p class="empty">No recent projects yet.</p>
        </div>
        <p class="status" id="project-health-status" role="status"></p>
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
    const claudeHookDetailsEl = document.querySelector("#claude-hook-details");
    const claudeHookStatusEl = document.querySelector("#claude-hook-status");
    const projectPathEl = document.querySelector("#project-path");
    const projectRecentsEl = document.querySelector("#project-recents");
    const checkHookButton = document.querySelector("#check-hook");
    const installHookButton = document.querySelector("#install-hook");
    const projectHealthEl = document.querySelector("#project-health");
    const projectHealthStatusEl = document.querySelector("#project-health-status");
    const refreshProjectsButton = document.querySelector("#refresh-projects");
    const projectRecentsKey = "agentsInWatch.projectRecents";

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

    function setClaudeHookStatus(message, className = "") {
      claudeHookStatusEl.textContent = message;
      claudeHookStatusEl.className = className ? "status " + className : "status";
    }

    function setProjectHealthStatus(message, className = "") {
      projectHealthStatusEl.textContent = message;
      projectHealthStatusEl.className = className ? "status " + className : "status";
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

    async function loadClaudeHookStatus() {
      try {
        const projectDir = getProjectPath();
        const query = projectDir ? "?projectDir=" + encodeURIComponent(projectDir) : "";
        const body = await requestJson("/diagnostics/claude-hook" + query);
        renderClaudeHookStatus(body);
        rememberProject(body.projectDir);
        await loadProjectHealth();
        setClaudeHookStatus("Updated " + new Date().toLocaleTimeString(), body.installed ? "approved" : "");
      } catch (error) {
        setClaudeHookStatus(error.message);
      }
    }

    async function installClaudeHook() {
      installHookButton.disabled = true;
      try {
        const projectDir = getProjectPath();
        if (!projectDir) {
          throw new Error("Enter a project path first.");
        }

        const body = await requestJson("/diagnostics/claude-hook/install", {
          method: "POST",
          body: JSON.stringify({
            projectDir,
            helperUrl: helperUrlEl.textContent || window.location.origin
          })
        });
        renderClaudeHookStatus(body);
        rememberProject(body.projectDir);
        await loadProjectHealth();
        setClaudeHookStatus("Hook installed.", "approved");
      } catch (error) {
        setClaudeHookStatus(error.message);
      } finally {
        installHookButton.disabled = false;
      }
    }

    async function loadProjectHealth() {
      refreshProjectsButton.disabled = true;
      try {
        const projectDirs = readProjectRecents();
        if (projectDirs.length === 0) {
          projectHealthEl.innerHTML = '<p class="empty">No recent projects yet.</p>';
          setProjectHealthStatus("");
          return;
        }

        const body = await requestJson("/diagnostics/claude-hook/batch", {
          method: "POST",
          body: JSON.stringify({ projectDirs })
        });
        renderProjectHealth(body.projects ?? []);
        setProjectHealthStatus("Updated " + new Date().toLocaleTimeString(), "approved");
      } catch (error) {
        setProjectHealthStatus(error.message);
      } finally {
        refreshProjectsButton.disabled = false;
      }
    }

    function renderDiagnostics(body) {
      pendingCountEl.textContent = body.summary?.pending ?? 0;
      resolvedCountEl.textContent = body.summary?.resolved ?? 0;
      responseCountEl.textContent = (body.agentResponses ?? []).length;
      renderRequestList(pendingRequestsEl, body.pendingRequests ?? [], "No pending requests.");
      renderResponseList(agentResponsesEl, body.agentResponses ?? []);
    }

    function renderClaudeHookStatus(body) {
      const rows = [
        ["Installed", body.installed ? "Yes" : "No"],
        ["Helper URL", body.helperUrl ?? "Not found"],
        ["Wait mode", body.waitForResponse ? "On" : "Off"],
        ["Output format", body.outputFormat ?? "Not found"],
        ["Project", body.projectDir ?? "Unknown"],
      ];

      const details = rows.map(([label, value]) => {
        const row = document.createElement("div");
        row.className = "hook-row";
        const labelEl = document.createElement("div");
        labelEl.className = "hook-label";
        labelEl.textContent = label;
        const valueEl = document.createElement("div");
        valueEl.className = "hook-value";
        valueEl.textContent = value;
        row.append(labelEl, valueEl);
        return row;
      });

      if (body.command) {
        const command = document.createElement("div");
        command.className = "hook-command";
        command.textContent = body.command;
        details.push(command);
      }

      claudeHookDetailsEl.replaceChildren(...details);
    }

    function renderProjectHealth(projects) {
      if (projects.length === 0) {
        projectHealthEl.innerHTML = '<p class="empty">No recent projects yet.</p>';
        return;
      }

      projectHealthEl.replaceChildren(...projects.map((project) => {
        const row = document.createElement("button");
        row.className = "health-row";
        row.type = "button";
        row.addEventListener("click", () => {
          projectPathEl.value = project.projectDir;
          loadClaudeHookStatus();
        });

        const status = document.createElement("div");
        status.className = project.installed ? "health-status approved" : "health-status off";
        status.textContent = project.installed ? "Ready" : "Missing";

        const copy = document.createElement("div");
        const path = document.createElement("div");
        path.className = "health-path";
        path.textContent = project.projectDir;
        const meta = document.createElement("div");
        meta.className = "health-meta";
        meta.textContent = project.helperUrl ?? "Hook not installed";
        copy.append(path, meta);

        row.append(status, copy);
        return row;
      }));
    }

    function getProjectPath() {
      return projectPathEl.value.trim();
    }

    function loadProjectRecents() {
      const recents = readProjectRecents();
      projectRecentsEl.replaceChildren(
        option("Recent projects", ""),
        ...recents.map((project) => option(project, project))
      );
      if (recents[0]) {
        projectPathEl.value = recents[0];
      }
    }

    function rememberProject(projectDir) {
      if (!projectDir) {
        return;
      }

      const recents = [projectDir, ...readProjectRecents().filter((item) => item !== projectDir)].slice(0, 6);
      localStorage.setItem(projectRecentsKey, JSON.stringify(recents));
      projectRecentsEl.replaceChildren(
        option("Recent projects", ""),
        ...recents.map((project) => option(project, project))
      );
      projectPathEl.value = projectDir;
    }

    function readProjectRecents() {
      try {
        const parsed = JSON.parse(localStorage.getItem(projectRecentsKey) ?? "[]");
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
      } catch {
        return [];
      }
    }

    function option(label, value) {
      const item = document.createElement("option");
      item.textContent = label;
      item.value = value;
      return item;
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
    checkHookButton.addEventListener("click", loadClaudeHookStatus);
    installHookButton.addEventListener("click", installClaudeHook);
    refreshProjectsButton.addEventListener("click", loadProjectHealth);
    projectRecentsEl.addEventListener("change", () => {
      if (projectRecentsEl.value) {
        projectPathEl.value = projectRecentsEl.value;
        loadClaudeHookStatus();
      }
    });
    loadNetworkInfo();
    loadProjectRecents();
    startPairing();
    loadClaims();
    loadDiagnostics();
    loadClaudeHookStatus();
    loadProjectHealth();
    setInterval(loadClaims, 2000);
    setInterval(loadDiagnostics, 2000);
    setInterval(loadClaudeHookStatus, 5000);
  </script>
</body>
</html>`;
}
