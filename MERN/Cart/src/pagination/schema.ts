import { makeExecutableSchema } from "@graphql-tools/schema";
import { paginationTypeDefs } from "./typeDefs";
import { paginationResolvers } from "./resolvers";

export const paginationSchema = makeExecutableSchema({
  typeDefs: paginationTypeDefs,
  resolvers: paginationResolvers,
});