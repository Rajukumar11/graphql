# Module 8 — Auth (JWT) ::: Context + Directives + Field-Level Rules
## Implementation Instruction File (Aligned with Modules 1–7, **No Breaking Changes**)

This module adds **authentication + authorization** on top of your existing system:
- Stitched schema architecture (`stitchedSchema`)
- MongoDB context from Module 6
- WebSocket subscriptions from Module 5
- Pagination from Module 7

✅ Goal: add auth in a way that keeps all existing APIs working, and only restricts the fields/queries you explicitly protect.

---

# 0) No-break design rules

1) ✅ Do NOT modify existing Module 6 cart/product logic  
2) ✅ Do NOT change existing Query/Mutation names used earlier  
3) ✅ Add Auth as an **add-on layer**:
   - extend context safely (add `user`)
   - add a directive transformer (`@auth`) that only affects fields marked with it
   - optionally add field-level rule resolvers only on sensitive fields (e.g., `User.email`)

4) ✅ Keep WS working:
   - WS context should still work if no token is provided (user = null)
   - Later you can add token via `connectionParams` safely

---

# 1) Dependencies

```bash
npm install jsonwebtoken dotenv
npm install @graphql-tools/utils
npm install -D @types/jsonwebtoken
```

If not already installed:
```bash
npm install @graphql-tools/schema @graphql-tools/stitch
```

---

# 2) Add .env (JWT secret)

Create `.env` in project root (same folder as `package.json`):

```env
JWT_SECRET=dev-secret-change-me
```

⚠️ No spaces around `=`.

Load env variables as early as possible (entry file).  
At the very top of `src/index.ts`:

```ts
import "dotenv/config";
```

---

# 3) Context Upgrade (Backward Compatible)

✅ We will extend context to include `user`, but keep the same signature so old code works.

Update: `src/context.ts`

### 3.1 Add types + helper
```ts
import jwt from "jsonwebtoken";
import DataLoader from "dataloader";
import type { Db } from "mongodb";

import { getDb } from "./db/mongo";
import { SimplePubSub } from "./pubsub";

export type AuthUser = {
  id: string;
  role: "USER" | "ADMIN";
};

export type GraphQLContext = {
  db: Db;
  loaders: {
    productLoader: DataLoader<string, any>;
  };
  pubsub: SimplePubSub;

  // ✅ NEW (Auth)
  user: AuthUser | null;

  // optional (already used in your WS presence module)
  userId?: string;
};

const pubsubSingleton = new SimplePubSub();

function parseAuthHeader(authorization?: string): AuthUser | null {
  if (!authorization) return null;

  const token = authorization.replace("Bearer ", "").trim();
  if (!token) return null;

  try {
    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(token, secret) as any;
    return { id: decoded.id, role: decoded.role };
  } catch {
    return null;
  }
}
```

### 3.2 Backward-compatible buildContext
```ts
export async function buildContext(input?: { authorization?: string }): Promise<GraphQLContext> {
  const db = await getDb();
  const user = parseAuthHeader(input?.authorization);

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
    loaders: { productLoader },
    pubsub: pubsubSingleton,
  };
}

export function getPubSub() {
  return pubsubSingleton;
}
```

✅ Old calls still work:
- HTTP previously: `buildContext()` ✅ still works
- WS previously: `await buildContext()` ✅ still works (user=null)

---

# 4) Update HTTP middleware to pass Authorization header

In `src/index.ts` (HTTP middleware section only):

```ts
app.use(
  "/graphql",
  expressMiddleware(apollo, {
    context: async ({ req }) => await buildContext({ authorization: req.headers.authorization }),
  })
);
```

✅ This does NOT break old requests (they just come in without auth header → user=null).

---

# 5) WS Context (keep working, add token later)

You MUST keep:
```ts
const base = await buildContext();
```

Example WS context block:

```ts
context: async (ctx) => {
  const base = await buildContext(); // user = null by default
  const userId = (ctx.extra as any).userId as string | undefined;

  return {
    ...base,
    pubsub,
    userId,
  };
},
```

Optional upgrade (later):
- accept `token` via `connectionParams`
- call `buildContext({ authorization: "Bearer " + token })`

---

# 6) Add @auth Directive (Schema + Transformer)

## 6.1 Directive definition
You can define it inside your new `user` schema (recommended), or a shared base schema.

Directive:
```graphql
directive @auth(role: String) on FIELD_DEFINITION
```

## 6.2 Implement directive transformer

Create: `src/auth/authDirective.ts`

```ts
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
```

---

# 7) Create User/Auth Subschema (New module)

Create folder:
```bash
mkdir -p src/user src/auth
```

## 7.1 `src/user/typeDefs.ts`
Because you use stitched subschemas, define `type Query` and `type Mutation` here.

```ts
export const userTypeDefs = `#graphql
  directive @auth(role: String) on FIELD_DEFINITION

  type User {
    id: ID!
    name: String!
    email: String!
    role: String!
  }

  type Query {
    me: User @auth
    adminStats: String! @auth(role: "ADMIN")
  }

  type Mutation {
    login(userId: ID!, role: String!): String!
  }
`;
```

## 7.2 `src/user/resolvers.ts`
```ts
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
```

## 7.3 `src/user/schema.ts`
```ts
import { makeExecutableSchema } from "@graphql-tools/schema";
import { userTypeDefs } from "./typeDefs";
import { userResolvers } from "./resolvers";

export const userSchema = makeExecutableSchema({
  typeDefs: userTypeDefs,
  resolvers: userResolvers,
});
```

---

# 8) Stitch userSchema + Apply directive transformer

Update `src/stitching/stitchedSchema.ts`:

```ts
import { stitchSchemas } from "@graphql-tools/stitch";

import { catalogSchema } from "../catalog/schema";
import { cartSchema } from "../cart/schema";
import { presenceSchema } from "../presence/schema";
import { paginationSchema } from "../pagination/schema"; // Module 7
import { userSchema } from "../user/schema";             // Module 8

import { authDirectiveTransformer } from "../auth/authDirective";

export const stitchedSchema = authDirectiveTransformer(
  stitchSchemas({
    subschemas: [
      catalogSchema,
      cartSchema,
      presenceSchema,
      paginationSchema,
      userSchema,
    ],
  })
);
```

✅ This does not break existing modules because:
- only fields marked with `@auth` are restricted
- all other queries/mutations remain open

---

# 9) Testing Steps (Auth + Regression)

## 9.1 Login (get token)
```graphql
mutation {
  login(userId: "u1", role: "USER")
}
```

Copy token.

## 9.2 Call `me` (requires header)
Headers:
```
Authorization: Bearer <TOKEN>
```

```graphql
query {
  me { id name email role }
}
```

✅ expected: returns user

## 9.3 Call `adminStats` as USER (should fail)
```graphql
query { adminStats }
```

✅ expected: FORBIDDEN

## 9.4 Login as ADMIN
```graphql
mutation {
  login(userId: "u2", role: "ADMIN")
}
```

Call:
```graphql
query { adminStats }
```

✅ expected: success

---

## 9.5 Regression test (Modules 5–7 must still pass)
After enabling auth, run:

### Cart tests (Module 6)
- `addToCart`
- `cart`
- `cartSummary`

### Pagination tests (Module 7)
- `productsCursor`
- `productsConnection`

### Presence tests (Module 5)
- Subscribe to `presenceUpdates` (WS still works)
- Connect with userId param

✅ expected: all still work because they do not require auth by default.

---

# 10) Security Notes (Production)
This module is a correct architecture foundation, but for real production you should add:
- password-based login / OAuth
- refresh tokens
- token revocation / rotation
- rate limits
- RBAC policy centralization
- audit logs

---

# Module 8 Completed ✅
You now have:
- JWT auth
- Context-based user injection
- @auth directive-based access control
- Field-level rules for sensitive data
- No breaking changes to Modules 1–7
