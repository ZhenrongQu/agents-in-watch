# Agent Response Poller Design

## Product Goal

Agents in Watch should provide a simple desktop-side command for adapter authors to fetch decisions that were made on iPhone or Apple Watch. The helper already stores unacknowledged responses in the response outbox; this slice makes that outbox usable from scripts without requiring each adapter to reimplement HTTP polling, auth headers, filtering, and acknowledgement behavior.

## Scope

In scope:

- Add a single-shot polling script for `/agent-responses`.
- Support filtering by `agentType` and `sessionId`.
- Support bearer-token auth through `AGENTS_IN_WATCH_TOKEN`.
- Print each response as newline-delimited JSON for shell pipelines and future adapter consumers.
- Require an explicit `--ack` flag before marking responses acknowledged.
- Document usage for Codex Desktop and Claude Code adapter workflows.

Out of scope:

- Automatically clicking Codex Desktop or Claude Code UI controls.
- Running as a daemon or long-polling process.
- Retrying failed network calls in the background.
- Transforming responses into adapter-specific command formats.
- Adding persistent response storage.

## User Experience

For a user, this is the next small step toward remote control. After they tap allow, deny, pause, or send a short reply from the watch, a developer or adapter script can run one command on the desktop to retrieve that decision.

The script should be safe during setup and debugging. By default, it only prints responses and leaves them in the outbox. When an adapter is ready to consume responses for real, it adds `--ack` so processed decisions no longer appear in later polls.

Example:

```bash
node scripts/poll-agent-responses.js --agent-type codex-desktop --session-id session-1
node scripts/poll-agent-responses.js --agent-type claude-code --ack
```

## Command Contract

Create `scripts/poll-agent-responses.js`.

Configuration sources:

- `AGENTS_IN_WATCH_HELPER_URL`, defaulting to `http://127.0.0.1:42731`.
- `AGENTS_IN_WATCH_TOKEN`, optional bearer token.
- `AGENTS_IN_WATCH_AGENT_TYPE`, used when `--agent-type` is not provided.
- `AGENTS_IN_WATCH_SESSION_ID`, used when `--session-id` is not provided.

Flags:

- `--agent-type <value>` filters responses by agent type, such as `codex-desktop` or `claude-code`.
- `--session-id <value>` filters responses by session id.
- `--ack` acknowledges each response after it has been written to stdout.
- `--help` prints concise usage information.

Output:

- Each response is printed as one JSON object per line.
- If there are no matching responses, the script prints nothing and exits with status `0`.
- Error messages go to stderr and exit non-zero.

Acknowledgement behavior:

- Without `--ack`, the script never calls the ack endpoint.
- With `--ack`, the script prints all fetched responses first, then acknowledges them one by one.
- If acknowledgement fails, the script exits non-zero and includes the response id in the error message.

## Architecture

Keep the implementation as a small script rather than adding a new shared client abstraction. The project currently has only one consumer for this behavior, so a standalone script is simpler and easier to reason about.

The script should:

1. Parse flags and environment defaults.
2. Build a `/agent-responses` URL with optional query parameters.
3. Send `GET /agent-responses` with the same bearer-token convention used by existing scripts.
4. Validate that the helper returns a JSON object with a `responses` array.
5. Write each response as newline-delimited JSON.
6. If `--ack` is set, send `POST /agent-responses/:id/ack` for each printed response.

No helper, store, iPhone, or Watch changes are required because the response outbox API already exists.

## Error Handling

The script should fail clearly when:

- The helper cannot be reached.
- The helper returns a non-2xx response.
- The helper response is not valid JSON.
- The helper response does not include a `responses` array.
- An ack request fails.

The script should keep messages practical for non-expert users, for example:

```text
failed to fetch agent responses: helper returned 401 {"error":"unauthorized"}
failed to acknowledge response response-outbox-1: helper returned 404 {"error":"response not found"}
```

## Testing

Node tests should cover:

- The script fetches responses from a fake helper and prints newline-delimited JSON.
- `--agent-type` and `--session-id` are encoded into the request URL.
- Environment defaults are used when flags are absent.
- The script includes the bearer token when `AGENTS_IN_WATCH_TOKEN` is configured.
- The script does not acknowledge responses unless `--ack` is present.
- With `--ack`, the script acknowledges each printed response.
- Helper rejection exits non-zero with a useful error.
- Invalid helper JSON exits non-zero with a useful error.

Full verification should still run the existing Node and Swift test suites because this script is part of the desktop helper workflow, even though mobile code does not change.

## Release Notes

README should add a short "Poll agent responses" section showing:

1. Start the helper.
2. Send or create a request.
3. Respond from iPhone or Watch.
4. Run the poller for `codex-desktop` or `claude-code`.
5. Add `--ack` when an adapter is ready to consume responses.

The docs should explicitly say that this command fetches decisions but does not yet apply them into live Codex Desktop or Claude Code sessions.
