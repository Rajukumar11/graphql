import { makeExecutableSchema } from "@graphql-tools/schema";
import { catalogTypeDefs } from "./typeDefs";
import { catalogResolvers } from "./resolvers";

export const catalogSchema = makeExecutableSchema({
  typeDefs: catalogTypeDefs,
  resolvers: catalogResolvers,
});