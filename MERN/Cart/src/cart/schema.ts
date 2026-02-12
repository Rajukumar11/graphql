import { makeExecutableSchema } from "@graphql-tools/schema";
import { cartTypeDefs } from "./typeDefs";
import { cartResolvers } from "./resolvers";

export const cartSchema = makeExecutableSchema({
  typeDefs: cartTypeDefs,
  resolvers: cartResolvers,
});