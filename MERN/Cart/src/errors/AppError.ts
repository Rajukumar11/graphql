import { GraphQLError } from "graphql";
import type { ErrorCode } from "./errorCodes";

/**
 * AppError = safe error we intentionally throw to clients.
 * - message: safe for clients
 * - extensions.code: stable error code
 * - extensions.details: optional debugging details (avoid secrets)
 */
export class AppError extends GraphQLError {
  constructor(message: string, code: ErrorCode, details?: unknown) {
    super(message, {
      extensions: {
        code,
        details,
      },
    });
  }
}