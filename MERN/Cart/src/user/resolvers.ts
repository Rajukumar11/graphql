import jwt from "jsonwebtoken";
import { GraphQLError } from "graphql";
import type { GraphQLContext } from "../context";

const users = [
  { id: "u1", name: "Deepak", email: "deepak@example.com", role: "USER" },
  { id: "u2", name: "Admin", email: "admin@example.com", role: "ADMIN" },
];

function signToken(payload: { id: string; role: string }) {
  const secret = process.env.JWT_SECRET!;
  return jwt.sign(payload, secret, { expiresIn: "1h" });
}

export const userResolvers = {
  Query: {
    me: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.user) return null;
      return users.find((u) => u.id === ctx.user!.id) ?? null;
    },
    adminStats: () => "Top secret admin stats",
  },

  Mutation: {
    login: (_: unknown, args: { userId: string; role: string }) => {
      return signToken({ id: args.userId, role: args.role as any });
    },
  },

  // ✅ Field-level rule: protect email
  User: {
    email: (parent: any, _: unknown, ctx: GraphQLContext) => {
      if (ctx.user?.role === "ADMIN") return parent.email;
      if (ctx.user?.id === parent.id) return parent.email;

      throw new GraphQLError("FORBIDDEN", {
        extensions: { code: "FORBIDDEN" },
      });
    },
  },
};