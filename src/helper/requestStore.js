import {
  normalizeAgentRequest,
  normalizeAgentResponse,
} from "../shared/requestModel.js";

export function createRequestStore() {
  const requests = new Map();
  let sequence = 0;

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
      return resolved;
    },
  };
}
