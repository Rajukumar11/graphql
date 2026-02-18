import { AppError } from "./AppError";
import { ErrorCodes } from "./errorCodes";
export const Errors = {
  unauthenticated: () =>
    new AppError("Login required", ErrorCodes.UNAUTHENTICATED),

  forbidden: () =>
    new AppError("Access denied", ErrorCodes.FORBIDDEN),

  notFound: (entity: string) =>
    new AppError(`${entity} not found`, ErrorCodes.NOT_FOUND),

  badInput: (message: string, details?: unknown) =>
    new AppError(message, ErrorCodes.BAD_USER_INPUT, details),

  conflict: (message: string) =>
    new AppError(message, ErrorCodes.CONFLICT),
};