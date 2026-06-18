export async function postRequestAndMaybeWait({
  helperUrl,
  request,
  token,
  waitForResponse,
  pollIntervalMs,
  timeoutMs,
}) {
  const headers = { "content-type": "application/json" };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const createResponse = await fetch(`${helperUrl}/requests`, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });

  if (!createResponse.ok) {
    const body = await createResponse.text();
    throw new Error(`helper rejected request: ${createResponse.status} ${body}`);
  }

  if (!waitForResponse) {
    return null;
  }

  return waitForAgentResponse({
    helperUrl,
    headers,
    agentType: request.agentType,
    sessionId: request.sessionId,
    pollIntervalMs,
    timeoutMs,
  });
}

function waitForAgentResponse({ helperUrl, headers, agentType, sessionId, pollIntervalMs, timeoutMs }) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const responses = await fetchAgentResponses({ helperUrl, headers, agentType, sessionId });
        if (responses.length > 0) {
          resolve(responses[0]);
          return;
        }

        if (Date.now() >= deadline) {
          reject(new Error(`timed out waiting for agent response after ${timeoutMs}ms`));
          return;
        }

        setTimeout(poll, Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
}

async function fetchAgentResponses({ helperUrl, headers, agentType, sessionId }) {
  const url = new URL("/agent-responses", helperUrl);
  url.searchParams.set("agentType", agentType);
  url.searchParams.set("sessionId", sessionId);

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`failed to fetch agent responses: ${response.status} ${body}`);
  }

  const body = await response.json();
  if (!body || typeof body !== "object" || !Array.isArray(body.responses)) {
    throw new Error("failed to fetch agent responses: helper response missing responses array");
  }

  return body.responses;
}

export async function acknowledgeAgentResponse({ helperUrl, token, responseId }) {
  if (!responseId) {
    throw new Error("failed to acknowledge response: response id is missing");
  }

  const headers = {};
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${helperUrl}/agent-responses/${encodeURIComponent(responseId)}/ack`, {
    method: "POST",
    headers,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`failed to acknowledge response ${responseId}: ${response.status} ${body}`);
  }
}

export function readRuntimeOptions(env) {
  return {
    helperUrl: env.AGENTS_IN_WATCH_HELPER_URL ?? "http://127.0.0.1:42731",
    pollIntervalMs: readPositiveInteger(env.AGENTS_IN_WATCH_POLL_INTERVAL_MS ?? "1000", "AGENTS_IN_WATCH_POLL_INTERVAL_MS"),
    timeoutMs: readPositiveInteger(env.AGENTS_IN_WATCH_TIMEOUT_MS ?? "300000", "AGENTS_IN_WATCH_TIMEOUT_MS"),
    token: env.AGENTS_IN_WATCH_TOKEN,
    waitForResponse: env.AGENTS_IN_WATCH_WAIT_FOR_RESPONSE === "1",
  };
}

function readPositiveInteger(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return number;
}
