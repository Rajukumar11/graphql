import { makeExecutableSchema } from "@graphql-tools/schema";
import { userTypeDefs } from "./typeDefs";
import { userResolvers } from "./resolvers";

export const userSchema = makeExecutableSchema({
  typeDefs: userTypeDefs,
  resolvers: userResolvers,
});