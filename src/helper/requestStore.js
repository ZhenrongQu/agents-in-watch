import {
  normalizeAgentRequest,
  normalizeAgentResponse,
} from "../shared/requestModel.js";

export function createRequestStore() {
  const requests = new Map();
  const responseOutbox = new Map();
  let sequence = 0;
  let responseSequence = 0;

  return {
    add(input) {
      const request = {
        ...normalizeAgentRequest(input),
        sequence: ++sequence,
      };
      requests.set(request.id, request);
      return request;
    },

    listPending() {
      return [...requests.values()]
        .filter((request) => request.status === "pending")
        .sort((a, b) => b.sequence - a.sequence);
    },

    listResolved(limit = 10) {
      return [...requests.values()]
        .filter((request) => request.status === "resolved")
        .sort((a, b) => b.sequence - a.sequence)
        .slice(0, limit)
        .map(({ sequence, ...request }) => request);
    },

    summary() {
      const allRequests = [...requests.values()];
      return {
        pending: allRequests.filter((request) => request.status === "pending").length,
        resolved: allRequests.filter((request) => request.status === "resolved").length,
        total: allRequests.length,
      };
    },

    resolve(input) {
      const response = normalizeAgentResponse(input);
      const request = requests.get(response.requestId);

      if (!request) {
        throw new Error("request not found");
      }

      if (request.status !== "pending") {
        throw new Error("request is already resolved");
      }

      const resolved = {
        ...request,
        status: "resolved",
        resolvedAt: new Date().toISOString(),
        response,
      };
      requests.set(request.id, resolved);
      const outboxId = `response-outbox-${++responseSequence}`;
      responseOutbox.set(outboxId, {
        id: outboxId,
        requestId: request.id,
        agentType: request.agentType,
        projectName: request.projectName,
        computerName: request.computerName,
        sessionId: request.sessionId,
        requestType: request.requestType,
        title: request.title,
        response,
        createdAt: resolved.resolvedAt,
        acknowledgedAt: null,
        sequence: responseSequence,
      });
      return resolved;
    },

    listAgentResponses(filters = {}) {
      return [...responseOutbox.values()]
        .filter((item) => item.acknowledgedAt === null)
        .filter((item) => !filters.agentType || item.agentType === filters.agentType)
        .filter((item) => !filters.sessionId || item.sessionId === filters.sessionId)
        .sort((a, b) => a.sequence - b.sequence)
        .map(({ sequence, ...item }) => item);
    },

    diagnostics() {
      return {
        summary: this.summary(),
        pendingRequests: this.listPending().map(({ sequence, ...request }) => request),
        resolvedRequests: this.listResolved(10),
        agentResponses: this.listAgentResponses(),
      };
    },

    ackAgentResponse(id) {
      const item = responseOutbox.get(id);
      if (!item) {
        throw new Error("response not found");
      }
      if (item.acknowledgedAt !== null) {
        throw new Error("response is already acknowledged");
      }
      const acknowledged = {
        ...item,
        acknowledgedAt: new Date().toISOString(),
      };
      responseOutbox.set(id, acknowledged);
      const { sequence, ...publicItem } = acknowledged;
      return publicItem;
    },
  };
}
