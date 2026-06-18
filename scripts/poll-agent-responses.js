#!/usr/bin/env node

const DEFAULT_HELPER_URL = "http://127.0.0.1:42731";

try {
  const options = parseArgs(process.argv.slice(2), process.env);

  if (options.help) {
    usage();
    process.exit(0);
  }

  const headers = {};
  if (options.token) {
    headers.authorization = `Bearer ${options.token}`;
  }

  const responses = await waitForResponses(options, headers);

  for (const response of responses) {
    console.log(JSON.stringify(response));
  }

  if (options.ack) {
    for (const response of responses) {
      await acknowledgeResponse(options.helperUrl, response.id, headers);
    }
  }

  process.exit(0);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

function parseArgs(args, env) {
  const options = {
    ack: false,
    agentType: env.AGENTS_IN_WATCH_AGENT_TYPE,
    helperUrl: env.AGENTS_IN_WATCH_HELPER_URL ?? DEFAULT_HELPER_URL,
    help: false,
    pollIntervalMs: Number(env.AGENTS_IN_WATCH_POLL_INTERVAL_MS ?? 1000),
    sessionId: env.AGENTS_IN_WATCH_SESSION_ID,
    timeoutMs: Number(env.AGENTS_IN_WATCH_TIMEOUT_MS ?? 300000),
    token: env.AGENTS_IN_WATCH_TOKEN,
    wait: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--ack") {
      options.ack = true;
      continue;
    }

    if (arg === "--wait") {
      options.wait = true;
      continue;
    }

    if (arg === "--agent-type") {
      options.agentType = readFlagValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--poll-interval-ms") {
      options.pollIntervalMs = readPositiveInteger(readFlagValue(args, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg === "--session-id") {
      options.sessionId = readFlagValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--timeout-ms") {
      options.timeoutMs = readPositiveInteger(readFlagValue(args, index, arg), arg);
      index += 1;
      continue;
    }

    throw new Error(`unknown option: ${arg}`);
  }

  options.pollIntervalMs = validatePositiveInteger(options.pollIntervalMs, "AGENTS_IN_WATCH_POLL_INTERVAL_MS");
  options.timeoutMs = validatePositiveInteger(options.timeoutMs, "AGENTS_IN_WATCH_TIMEOUT_MS");

  return options;
}

function readFlagValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`missing value for ${flag}`);
  }
  return value;
}

function readPositiveInteger(value, name) {
  return validatePositiveInteger(Number(value), name);
}

function validatePositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

async function waitForResponses(options, headers) {
  const deadline = Date.now() + options.timeoutMs;

  while (true) {
    const responses = await fetchResponses(options, headers);
    if (responses.length > 0 || !options.wait) {
      return responses;
    }

    if (Date.now() >= deadline) {
      throw new Error(`timed out waiting for agent responses after ${options.timeoutMs}ms`);
    }

    await sleep(Math.min(options.pollIntervalMs, Math.max(0, deadline - Date.now())));
  }
}

async function fetchResponses(options, headers) {
  const url = new URL("/agent-responses", options.helperUrl);
  if (options.agentType) {
    url.searchParams.set("agentType", options.agentType);
  }
  if (options.sessionId) {
    url.searchParams.set("sessionId", options.sessionId);
  }

  let response;
  try {
    response = await fetch(url, { headers });
  } catch (error) {
    throw new Error(`failed to fetch agent responses: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`failed to fetch agent responses: ${await formatHttpError(response)}`);
  }

  const body = await parseJsonResponse(response, "failed to parse agent responses");
  if (!body || typeof body !== "object" || !Array.isArray(body.responses)) {
    throw new Error("failed to fetch agent responses: helper response missing responses array");
  }

  return body.responses;
}

async function acknowledgeResponse(helperUrl, responseId, headers) {
  if (!responseId) {
    throw new Error("failed to acknowledge response: response id is missing");
  }

  const url = new URL(`/agent-responses/${encodeURIComponent(responseId)}/ack`, helperUrl);

  let response;
  try {
    response = await fetch(url, { method: "POST", headers });
  } catch (error) {
    throw new Error(`failed to acknowledge response ${responseId}: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`failed to acknowledge response ${responseId}: ${await formatHttpError(response)}`);
  }
}

async function parseJsonResponse(response, context) {
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

async function formatHttpError(response) {
  const body = await response.text();
  return `helper returned ${response.status} ${body}`;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function usage() {
  console.log(`Usage: node scripts/poll-agent-responses.js [options]

Options:
  --agent-type <value>  Filter responses by agent type
  --session-id <value>  Filter responses by session id
  --ack                 Acknowledge each printed response
  --wait                Keep polling until a response is available
  --poll-interval-ms    Delay between polls in wait mode (default: 1000)
  --timeout-ms          Maximum wait duration in milliseconds (default: 300000)
  --help, -h            Show this help

Environment:
  AGENTS_IN_WATCH_HELPER_URL   Helper base URL (default: ${DEFAULT_HELPER_URL})
  AGENTS_IN_WATCH_TOKEN        Bearer token for helper requests
  AGENTS_IN_WATCH_AGENT_TYPE   Default agent type filter
  AGENTS_IN_WATCH_SESSION_ID   Default session id filter
  AGENTS_IN_WATCH_POLL_INTERVAL_MS  Default wait poll interval
  AGENTS_IN_WATCH_TIMEOUT_MS        Default wait timeout
`);
}
