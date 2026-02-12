
# Module 5 (Practical) — WebSocket Setup + Presence Updates (GraphQL Subscriptions)

This module continues the **same Ecommerce Cart GraphQL project** and adds **real-time** features:

✅ Module 5 focus:
- Add **GraphQL Subscriptions** over **WebSocket**
- Implement a simple **presence system** (user online/offline + heartbeat)
- Keep it practical and incremental
- Still no Mongo needed (presence is in-memory for now)

> NOTE: Apollo Server v5 uses a separate WebSocket server for subscriptions.
> We will use **graphql-ws** + **ws**.

---

## 1) WHAT we build

A single app that exposes:
- HTTP GraphQL endpoint: `http://localhost:4000/graphql`
- WebSocket endpoint: `ws://localhost:4000/graphql`

New capabilities:
- Client can subscribe to presence events: `presenceUpdates`
- Server publishes presence updates when users connect/disconnect
- Simple heartbeat keeps presence accurate

---

## 2) WHY this matters (Engineering)

Presence is a classic real-time use case:
- Online/Offline indicator
- Live dashboards
- Typing indicators (later)
- Real-time order/cart events (later)

GraphQL Subscriptions enable **server → client push** with a stable schema contract.

---

## 3) WHEN to use subscriptions

Use subscriptions when:
- clients need live updates (presence, chat, order status)
- polling is wasteful
- updates are event-driven

Avoid subscriptions when:
- updates are infrequent (use cache-and-network / polling)
- you cannot maintain long-lived connections (some infra constraints)

---

# A) Install Dependencies

```bash
npm install ws graphql-ws
npm install -D @types/node @types/express 
@types/ws
```

---

# B) Add Presence Schema (Stitched as a separate schema)

We will keep presence as its own small schema and stitch it like other domains.

Create folder:
```bash
mkdir -p src/presence
```

## 1) `src/presence/typeDefs.ts`
```ts
export const presenceTypeDefs = `#graphql
  type PresenceEvent {
    userId: ID!
    status: String! # ONLINE | OFFLINE
    lastSeenAt: String!
  }

  type Query {
    # simple query for debugging
    onlineUsers: [ID!]!
  }

  type Subscription {
    presenceUpdates: PresenceEvent!
  }
`;
```

## 2) `src/presence/resolvers.ts`
```ts
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
```
ts
import type { GraphQLContext } from "../context";

// In-memory presence state
const onlineMap = new Map<string, number>(); // userId -> lastSeenAt (epoch ms)

function nowIso() {
  return new Date().toISOString();
}

// ✅ Keep only ONE cleanup timer (important in dev hot-reload)
let cleanupTimer: NodeJS.Timeout | null = null;

export const presenceResolvers = {
  Query: {
    onlineUsers: () => Array.from(onlineMap.keys()),
  },

  Subscription: {
    presenceUpdates: {
      // graphql-ws needs an AsyncIterator for subscribe()
      subscribe: (_: unknown, __: unknown, ctx: GraphQLContext) => {
        return ctx.pubsub.asyncIterator("PRESENCE_UPDATES");
      },

      // ✅ Ensure correct payload shape for the Subscription field
      resolve: (payload: any) => payload.presenceUpdates,
    },
  },

  // helper exports for server WS hooks (we will call these from index.ts)
  __internal: {
    // ✅ Call this ONCE from index.ts after PubSub is created
    startCleanup(pubsub: GraphQLContext["pubsub"]) {
      if (cleanupTimer) return; // already running

      cleanupTimer = setInterval(() => {
        const now = Date.now();
        const thresholdMs = 30_000; // 30s offline threshold (demo)

        for (const [userId, lastSeen] of onlineMap.entries()) {
          if (now - lastSeen > thresholdMs) {
            onlineMap.delete(userId);

            // ✅ Publish OFFLINE when auto-expiring users
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
  },
};
```

## 3) `src/presence/schema.ts`
```ts
import { makeExecutableSchema } from "@graphql-tools/schema";
import { presenceTypeDefs } from "./typeDefs";
import { presenceResolvers } from "./resolvers";

export const presenceSchema = makeExecutableSchema({
  typeDefs: presenceTypeDefs,
  resolvers: presenceResolvers,
});
```

---

# C) Add a Simple PubSub (No extra library)

Apollo v5 does not ship PubSub by default. We’ll implement a tiny in-memory PubSub
that supports `publish()` and `asyncIterator()`.

## 1) Create `src/pubsub.ts`
```ts
type Listener = (payload: any) => void;

export class SimplePubSub {
  private listeners = new Map<string, Set<Listener>>();

  publish(topic: string, payload: any) {
    const set = this.listeners.get(topic);
    if (!set) return;
    for (const fn of set) fn(payload);
  }

  asyncIterator(topic: string) {
    const queue: any[] = [];
    let resolveNext: ((v: IteratorResult<any>) => void) | null = null;

    const pushValue = (payload: any) => {
      if (resolveNext) {
        resolveNext({ value: payload, done: false });
        resolveNext = null;
      } else {
        queue.push(payload);
      }
    };

    const subscribe = () => {
      const set = this.listeners.get(topic) ?? new Set<Listener>();
      set.add(pushValue);
      this.listeners.set(topic, set);
      return () => set.delete(pushValue);
    };

    const unsubscribe = subscribe();

    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next(): Promise<IteratorResult<any>> {
        if (queue.length > 0) {
          return Promise.resolve({ value: queue.shift(), done: false });
        }
        return new Promise((resolve) => (resolveNext = resolve));
      },
      return(): Promise<IteratorResult<any>> {
        unsubscribe();
        return Promise.resolve({ value: undefined, done: true });
      },
      throw(err: any): Promise<IteratorResult<any>> {
        unsubscribe();
        return Promise.reject(err);
      },
    };
  }
}
```

✅ This is enough for learning. In production you’ll use Redis PubSub / Kafka, etc.

---

# D) Update Context to include PubSub + Loaders

We already created `context.ts` in Module 4 for DataLoader.
Now we will add `pubsub` to it.

## Update `src/context.ts`
Replace with:

```ts
import DataLoader from "dataloader";
import { getProductsByIds } from "./catalog/store";
import { SimplePubSub } from "./pubsub";

export type GraphQLContext = {
  loaders: {
    productLoader: DataLoader<string, any>;
  };
  pubsub: SimplePubSub;
};

// IMPORTANT: PubSub should be shared for the whole server process
// so all requests + WS connections publish to the same event bus.
const pubsubSingleton = new SimplePubSub();

export function buildContext(): GraphQLContext {
  const productLoader = new DataLoader<string, any>(async (ids) => {
    return getProductsByIds(ids);
  });

  return {
    loaders: { productLoader },
    pubsub: pubsubSingleton,
  };
}

export function getPubSub() {
  return pubsubSingleton;
}
```

---

# E) Stitch Presence Schema into the Unified Schema

Update `src/stitching/stitchedSchema.ts` to include presence.

```ts
import { stitchSchemas } from "@graphql-tools/stitch";
import { catalogSchema } from "../catalog/schema";
import { cartSchema } from "../cart/schema";
import { presenceSchema } from "../presence/schema";

export const stitchedSchema = stitchSchemas({
  subschemas: [catalogSchema, cartSchema, presenceSchema],
});
```

---

# F) WebSocket Server Setup (graphql-ws)

We’ll attach a WebSocket server to the same HTTP server as Express.

## Update `src/index.ts` (important)

Replace your `src/index.ts` with this full version:

```ts
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { createServer } from "http";

import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";

import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/use/ws";

import { stitchedSchema } from "./stitching/stitchedSchema";
import { buildContext, getPubSub } from "./context";
import { presenceResolvers } from "./presence/resolvers";

function parseUserIdFromConnectionParams(params: any): string | null {
  // For Module 4 simplicity:
  // Client sends: connectionParams: { userId: "u1" }
  const userId = params?.userId;
  return typeof userId === "string" && userId.trim() ? userId.trim() : null;
}

async function start() {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  const apollo = new ApolloServer({
    schema: stitchedSchema,
  });

  await apollo.start();

  app.use("/graphql", expressMiddleware(apollo, {
    context: async () => buildContext(),
  }));

  // Create HTTP server (so WS can share the same port)
  const httpServer = createServer(app);

  // WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });

  // Hook presence updates on connect/disconnect
  useServer(
    {
      schema: stitchedSchema,
      context: async (ctx) => {
        // ctx.connectionParams comes from client when connecting
        const userId = parseUserIdFromConnectionParams(ctx.connectionParams);
        const baseCtx = buildContext();
        const pubsub = getPubSub();

        // ✅ Start presence auto-offline cleanup (once per process)
        (presenceResolvers as any).__internal.startCleanup(pubsub);

        // presence connect
        if (userId) {
          (presenceResolvers as any).__internal.setOnline(userId, pubsub);
        }

        // heartbeat message (optional): client can send keep-alive using ping frames;
        // We'll keep it simple for now (see section G).
        return baseCtx;
      },
      onDisconnect: async (ctx, code, reason) => {
        // Not all clients expose params on disconnect reliably, so we keep it simple:
        // If you want precise disconnect per user, track socket->userId map (see section G).
        // For this module, we rely on heartbeat cleanup (also in section G).
      },
    },
    wsServer
  );

  const port = 4000;
  httpServer.listen(port, () => {
    console.log(`🚀 HTTP GraphQL: http://localhost:${port}/graphql`);
    console.log(`🔌 WS GraphQL:   ws://localhost:${port}/graphql`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

✅ Now your server supports both HTTP and WS on the same port.

---

# G) Presence Accuracy (Disconnect + Heartbeat Cleanup)

### Problem
WebSocket disconnect is not always clean (network drop, laptop sleep).

### Solution
Use a heartbeat + cleanup loop.

**Simple approach**:
- Client sends ping/heartbeat every X seconds (or WS ping)
- Server marks `lastSeenAt`
- Server cleanup loop removes users idle > threshold and publishes OFFLINE

Instead of a top-level `setInterval` (which can’t publish OFFLINE because it lacks `pubsub`), we start a cleanup loop via `presenceResolvers.__internal.startCleanup(pubsub)` from `index.ts`.

✅ This cleanup loop:
- expires idle users (no heartbeat)
- publishes `OFFLINE` via PubSub
- avoids duplicate intervals during dev hot-reload


✅ In production, you’d publish OFFLINE via Redis-based pubsub
and track sockets precisely. For now, this is enough to understand the system.

---

# H) Test Subscriptions

## 1) Open GraphQL page
Go to:
- `http://localhost:4000/graphql`

Some explorers may not support WS subscriptions out of the box.
If yours doesn’t, use a WS client tool (like Hoppscotch / Altair) or a small Node test.

### Subscription operation
```graphql
subscription {
  presenceUpdates {
    userId
    status
    lastSeenAt
  }
}
```

## 2) Connect with connectionParams
When connecting via WebSocket, send:
```json
{
  "userId": "u1"
}
```

Then connect again with:
```json
{
  "userId": "u2"
}
```

You should see presence events:
- u1 ONLINE
- u2 ONLINE

---

# I) Common Mistakes (Fast Fix)

### ❌ “Cannot find module graphql-ws/lib/use/ws”
Ensure you installed:
```bash
npm install graphql-ws ws
```

### ❌ Subscriptions not working in browser explorer
Use Altair or a WS-capable client, or build a simple client (next module can include this).

### ❌ Presence updates not firing
Ensure:
- `presenceSchema` is included in `stitchedSchema`
- `pubsub` exists in context
- WS uses path `/graphql` on same port

---

# Module 4 Complete ✅

You now have:
- WebSocket server (`graphql-ws`) attached to Express HTTP server
- `Subscription.presenceUpdates` live stream
- Basic presence events on connect
- Foundation for real-time order/cart events later

Next module preview:
- Proper socket→user mapping for accurate offline events
- Authenticated subscriptions (JWT in connectionParams)
- Redis pubsub for multi-instance scaling
