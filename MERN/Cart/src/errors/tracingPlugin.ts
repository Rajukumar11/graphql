import { randomUUID } from "crypto";

export function tracingPlugin() {
  return {
    async requestDidStart() {
      const traceId = randomUUID();
      const start = Date.now();

      return {
        async willSendResponse() {
          const ms = Date.now() - start;
          // ✅ Server-side trace log (safe)
          console.log(`TRACE ${traceId} — ${ms}ms`);
        },

        // expose traceId so formatError can use it if needed
        async didResolveOperation(requestContext: any) {
          requestContext.contextValue.__traceId = traceId;
        },
      };
    },
  };
}