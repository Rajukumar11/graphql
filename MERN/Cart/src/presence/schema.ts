import { makeExecutableSchema } from "@graphql-tools/schema";
import { presenceTypeDefs } from "./typeDefs";
import { presenceResolvers } from "./resolvers";

export const presenceSchema = makeExecutableSchema({
  typeDefs: presenceTypeDefs,
  resolvers: presenceResolvers,
});