# Module 8 (Practical) --- Error Handling: Masking + Extensions + Tracing (Ecommerce Cart)

This module continues the same incremental GraphQL project and adds
**production-grade error handling**.

✅ Module 8 focus: - Error masking (hide internal errors from clients) -
Custom error codes via `extensions` - Request tracing with `requestId` -
Global formatError strategy in Apollo Server

We will make the API: - Safe for production - Debuggable internally -
Clean for frontend consumption

------------------------------------------------------------------------

# 1) WHAT we add

### A) Error Masking

Prevent leaking: - stack traces - database details - internal
implementation messages

### B) Structured Error Codes

Return consistent codes: - UNAUTHENTICATED - FORBIDDEN -
BAD_USER_INPUT - INTERNAL_SERVER_ERROR

### C) Request Tracing

Attach a `requestId` to: - context - logs - GraphQL error extensions

------------------------------------------------------------------------

# 2) WHY this matters

Without masking: - Attackers see internal structure - DB schema leaks -
Stack traces exposed

Without structured extensions: - Frontend cannot properly handle errors

Without tracing: - Hard to debug production issues

------------------------------------------------------------------------

# A) Install UUID for requestId

``` bash
npm install uuid
npm install -D @types/uuid
```

------------------------------------------------------------------------

# B) Add requestId to context

Update `src/context.ts`:

``` ts
import { v4 as uuidv4 } from "uuid";

export async function buildContext(req?: any): Promise<GraphQLContext> {
  const db = await getDb();
  const user = getUserFromAuthHeader(req?.headers?.authorization);

  const requestId = uuidv4();

  const productLoader = new DataLoader<string, any>(async (ids) => {
    const rows = await db
      .collection("products")
      .find({ _id: { $in: ids as any } })
      .toArray();

    const map = new Map(rows.map((r: any) => [r._id, r]));
    return ids.map((id) => map.get(id) ?? null);
  });

  return {
    db,
    user,
    requestId,
    loaders: { productLoader },
    pubsub: pubsubSingleton,
  };
}
```

Update GraphQLContext type:

``` ts
export type GraphQLContext = {
  db: Db;
  user: AuthUser | null;
  requestId: string;
  loaders: { productLoader: DataLoader<string, any> };
  pubsub: SimplePubSub;
};
```

------------------------------------------------------------------------

# C) Create Custom Error Classes

Create: `src/errors/AppError.ts`

``` ts
import { GraphQLError } from "graphql";

export class AppError extends GraphQLError {
  constructor(message: string, code: string, requestId: string) {
    super(message, {
      extensions: {
        code,
        requestId,
      },
    });
  }
}
```

Usage example inside resolver:

``` ts
if (!ctx.user) {
  throw new AppError("Authentication required", "UNAUTHENTICATED", ctx.requestId);
}
```

------------------------------------------------------------------------

# D) Global Error Masking (Apollo formatError)

Update `src/index.ts` when creating ApolloServer:

``` ts
const apollo = new ApolloServer({
  schema: stitchedSchema,

  formatError: (formattedError, error) => {
    const isProduction = process.env.NODE_ENV === "production";

    // Known safe errors (custom ones)
    const safeCodes = [
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "BAD_USER_INPUT"
    ];

    if (safeCodes.includes(formattedError.extensions?.code)) {
      return formattedError;
    }

    // Mask everything else
    return {
      message: isProduction
        ? "Internal server error"
        : formattedError.message,
      extensions: {
        code: "INTERNAL_SERVER_ERROR",
        requestId: formattedError.extensions?.requestId,
      },
    };
  },
});
```

✅ Behavior: - Custom AppError passes through - Unknown errors masked -
Stack traces hidden

------------------------------------------------------------------------

# E) Add Logging with requestId

Inside `formatError`, add logging:

``` ts
console.error("GraphQL Error:", {
  requestId: formattedError.extensions?.requestId,
  message: error.message,
  stack: error.stack,
});
```

Now logs contain requestId for correlation.

------------------------------------------------------------------------

# F) Example: Throwing Structured Errors

Inside a resolver:

``` ts
import { AppError } from "../errors/AppError";

if (!cart) {
  throw new AppError(
    "Cart not found",
    "BAD_USER_INPUT",
    ctx.requestId
  );
}
```

Frontend will receive:

``` json
{
  "errors": [
    {
      "message": "Cart not found",
      "extensions": {
        "code": "BAD_USER_INPUT",
        "requestId": "abc-123"
      }
    }
  ]
}
```

------------------------------------------------------------------------

# G) Test Error Handling

## 1) Call protected query without token

``` graphql
query {
  adminStats
}
```

Expect:

``` json
{
  "errors": [
    {
      "message": "UNAUTHENTICATED",
      "extensions": {
        "code": "UNAUTHENTICATED",
        "requestId": "..."
      }
    }
  ]
}
```

## 2) Force internal error (example)

Temporarily throw:

``` ts
throw new Error("DB connection failed");
```

Client sees:

``` json
{
  "errors": [
    {
      "message": "Internal server error",
      "extensions": {
        "code": "INTERNAL_SERVER_ERROR",
        "requestId": "..."
      }
    }
  ]
}
```

But server logs full stack.

------------------------------------------------------------------------

# Common Mistakes (Fast Fix)

### ❌ Returning raw Error()

Always throw GraphQLError or AppError.

### ❌ Exposing stack traces

Never send stack in extensions in production.

### ❌ Not logging requestId

Without it debugging becomes painful.

------------------------------------------------------------------------

# Module 8 Complete ✅

You now have: - Error masking for production safety - Structured error
codes via extensions - Request tracing using requestId - Centralized
error formatting

Next module preview: - Persisted Queries - CDN caching - Production
deployment patterns
