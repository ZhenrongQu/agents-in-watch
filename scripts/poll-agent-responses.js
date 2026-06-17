#!/usr/bin/env node

const DEFAULT_HELPER_URL = "http://127.0.0.1:42731";

try {
  const options = parseArgs(process.argv.slice(2), process.env);

  if (options.help) {
    printUsage();
    process.exit(0);
  }

  const headers = {};
  if (options.token) {
    headers.authorization = `Bearer ${options.token}`;
  }

  const responses = await fetchResponses(options, headers);

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
    sessionId: env.AGENTS_IN_WATCH_SESSION_ID,
    token: env.AGENTS_IN_WATCH_TOKEN,
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

    if (arg === "--agent-type") {
      options.agentType = readFlagValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--session-id") {
      options.sessionId = readFlagValue(args, index, arg);
      index += 1;
      continue;
    }

    throw new Error(`unknown option: ${arg}`);
  }

  return options;
}

function readFlagValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`missing value for ${flag}`);
  }
  return value;
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

function printUsage() {
  console.log(`Usage: node scripts/poll-agent-responses.js [options]

Options:
  --agent-type <value>  Filter responses by agent type
  --session-id <value>  Filter responses by session id
  --ack                 Acknowledge each printed response
  --help, -h            Show this help
`);
}
