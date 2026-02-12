import { GraphQLError, defaultFieldResolver, GraphQLSchema } from "graphql";
import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils";
import type { GraphQLContext } from "../context";

export function authDirectiveTransformer(schema: GraphQLSchema) {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const auth = getDirective(schema, fieldConfig, "auth")?.[0];
      if (!auth) return fieldConfig;

      const requiredRole = auth.role as string | undefined;
      const originalResolve = fieldConfig.resolve ?? defaultFieldResolver;

      fieldConfig.resolve = async (source, args, ctx: GraphQLContext, info) => {
        if (!ctx.user) {
          throw new GraphQLError("UNAUTHENTICATED", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        if (requiredRole && ctx.user.role !== requiredRole) {
          throw new GraphQLError("FORBIDDEN", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        return originalResolve(source, args, ctx, info);
      };

      return fieldConfig;
    },
  });
}