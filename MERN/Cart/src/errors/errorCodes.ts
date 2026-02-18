export const ErrorCodes = {
  // Auth / Security
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",

  // Client mistakes
  BAD_USER_INPUT: "BAD_USER_INPUT",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",

  // Infrastructure
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];