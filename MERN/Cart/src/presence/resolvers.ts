import type { GraphQLContext } from "../context";

// In-memory presence state
const onlineMap = new Map<string, number>(); // userId -> lastSeenAt (epoch ms)

function nowIso() {
  return new Date().toISOString();
}

let cleanupTimer: NodeJS.Timeout | null = null;

export const presenceResolvers = {
  Query: {
    onlineUsers: () => Array.from(onlineMap.keys()),
  },

  Subscription: {
    presenceUpdates: {
      subscribe: (_: unknown, __: unknown, ctx: GraphQLContext) => {
        return ctx.pubsub.asyncIterator("PRESENCE_UPDATES");
      },
      resolve: (payload: any) => payload.presenceUpdates,
    },
  },
};

// ✅ IMPORTANT: Export helpers separately (NOT inside resolvers)
export const presenceInternal = {
  startCleanup(pubsub: GraphQLContext["pubsub"]) {
    if (cleanupTimer) return;

    cleanupTimer = setInterval(() => {
      const now = Date.now();
      const thresholdMs = 30_000;

      for (const [userId, lastSeen] of onlineMap.entries()) {
        if (now - lastSeen > thresholdMs) {
          onlineMap.delete(userId);

          pubsub.publish("PRESENCE_UPDATES", {
            presenceUpdates: {
              userId,
              status: "OFFLINE",
              lastSeenAt: nowIso(),
            },
          });
        }
      }
    }, 10_000);
  },

  stopCleanup() {
    if (cleanupTimer) clearInterval(cleanupTimer);
    cleanupTimer = null;
  },

  setOnline(userId: string, pubsub: GraphQLContext["pubsub"]) {
    onlineMap.set(userId, Date.now());
    pubsub.publish("PRESENCE_UPDATES", {
      presenceUpdates: { userId, status: "ONLINE", lastSeenAt: nowIso() },
    });
  },

  setOffline(userId: string, pubsub: GraphQLContext["pubsub"]) {
    onlineMap.delete(userId);
    pubsub.publish("PRESENCE_UPDATES", {
      presenceUpdates: { userId, status: "OFFLINE", lastSeenAt: nowIso() },
    });
  },

  heartbeat(userId: string) {
    if (onlineMap.has(userId)) onlineMap.set(userId, Date.now());
  },
};