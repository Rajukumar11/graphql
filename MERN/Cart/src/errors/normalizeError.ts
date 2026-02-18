import type { GraphQLFormattedError } from "graphql";
import { ErrorCodes } from "./errorCodes";

export function normalizeFormattedError(
  formattedError: GraphQLFormattedError,
  traceId: string
) {
  const code = formattedError.extensions?.code;

  // If Apollo classified it as internal server error (or code missing), mask message.
  if (!code || code === ErrorCodes.INTERNAL_SERVER_ERROR) {
    return {
      message: "Internal server error",
      extensions: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        traceId,
      },
    };
  }

  // Safe errors pass through but still attach traceId
  return {
    ...formattedError,
    extensions: {
      ...formattedError.extensions,
      traceId,
    },
  };
}