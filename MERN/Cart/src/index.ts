import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { buildContext } from "./context";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { stitchedSchema } from "./stitching/stitchedSchema";
async function start() {
  const app = express();

  app.use(cors());
  app.use(bodyParser.json());

  const server = new ApolloServer({
    schema: stitchedSchema,
  });

  await server.start();
  app.use("/graphql", expressMiddleware(server, {
  context: async () => buildContext(),
}));

  const port = 4000;
  app.listen(port, () => {
    console.log(`🚀 GraphQL ready at http://localhost:${port}/graphql`);
  });
}

start().catch(console.error);