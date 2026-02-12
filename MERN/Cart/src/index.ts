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

import { presenceResolvers, presenceInternal } from "./presence/resolvers";

function parseUserIdFromConnectionParams(params: any): string | null {
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

  // ✅ HTTP GraphQL (Queries/Mutations) — fresh loaders each request
  app.use(
    "/graphql",
    expressMiddleware(apollo, {
      context: async () => buildContext(),
    })
  );

  const httpServer = createServer(app);

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });

  // ✅ shared pubsub for whole process
  const pubsub = getPubSub();

  // ✅ start presence cleanup ONCE
  presenceInternal.startCleanup(pubsub);

  useServer(
    {
      schema: stitchedSchema,

      // ✅ handshake/auth happens here
      onConnect: async (ctx) => {
        const userId = parseUserIdFromConnectionParams(ctx.connectionParams);

        if (!userId) {
          throw new Error("Missing userId in connectionParams");
        }

        // store for later usage (disconnect + context)
        (ctx.extra as any).userId = userId;

        // mark online
        presenceInternal.setOnline(userId, pubsub);
      },

      onDisconnect: async (ctx) => {
        const userId = (ctx.extra as any).userId as string | undefined;
        if (userId) {
          presenceInternal.setOffline(userId, pubsub);
        }
      },

      // ✅ context for subscriptions (fresh loaders + shared pubsub + userId)
      context: async (ctx) => {
        const base = buildContext(); // fresh DataLoader per WS operation
        const userId = (ctx.extra as any).userId as string | undefined;

        return {
          ...base,
          pubsub, // ensure it's the shared singleton
          userId,
        };
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
