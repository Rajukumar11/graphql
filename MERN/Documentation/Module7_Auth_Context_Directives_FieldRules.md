
# Module 7 (Practical) — Auth: Context + Directives + Field-Level Rules (Ecommerce Cart)

This module continues the **same incremental project** and adds **production-style auth**.

✅ Module 7 focus:
- **Authentication** (JWT) in **context**
- **Authorization** using **schema directives**
- **Field-level rules** for sensitive fields (example: `User.email`)
- Keep it practical and minimal, but correct

We will add:
- `User` type + `me` query
- `@auth` directive
- Field-level protection for `User.email`
- Basic `login` mutation to issue JWT (demo only)

---

## 1) WHAT we add

### A) Context authentication
Read JWT from `Authorization: Bearer <token>` and attach:
- `ctx.user = { id, role }`

### B) Directive authorization
Protect schema fields using:
```graphql
@auth(role: "ADMIN")
```

### C) Field-level rules
Example rule:
- `User.email` visible only to **self** or **ADMIN**

---

## 2) WHY this approach

- Context keeps auth identity **centralized**
- Directives keep authorization **declarative**
- Field-level rules prevent **data leakage** even if query is allowed

---

## 3) WHEN to use this
Use it when:
- You have roles/permissions
- Some fields are sensitive
- You want consistent enforcement across schema

---

# A) Install dependencies

```bash
npm install jsonwebtoken
npm install -D @types/jsonwebtoken
```

---

# B) Add .env (JWT secret)

Create `.env`:
```
JWT_SECRET=dev-secret-change-me
```

> For dev only. In prod, use secure secret management.

---

# C) Add User Schema (stitch as new domain)

Create folder:
```bash
mkdir -p src/user
```

## 1) `src/user/typeDefs.ts`
```ts
export const userTypeDefs = `#graphql
  directive @auth(role: String) on FIELD_DEFINITION

  type User {
    id: ID!
    name: String!
    email: String! # field-level rule will protect this
    role: String!
  }

  type Query {
    me: User @auth
    adminStats: String! @auth(role: "ADMIN")
  }

  type Mutation {
    # Demo login that returns a token (NOT production)
    login(userId: ID!, role: String!): String!
  }
`;
```

## 2) `src/user/resolvers.ts`
```ts
import jwt from "jsonwebtoken";
import { GraphQLError } from "graphql";
import type { GraphQLContext } from "../context";

// Fake user store (demo)
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
      // Demo-only: in real apps validate password
      return signToken({ id: args.userId, role: args.role });
    },
  },

  User: {
    // Field-level rule example:
    email: (parent: any, _: unknown, ctx: GraphQLContext) => {
      // Allow ADMIN to see all emails
      if (ctx.user?.role === "ADMIN") return parent.email;

      // Allow user to see own email only
      if (ctx.user?.id === parent.id) return parent.email;

      // Otherwise block
      throw new GraphQLError("FORBIDDEN", {
        extensions: { code: "FORBIDDEN" },
      });
    },
  },
};
```

## 3) `src/user/schema.ts`
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

# D) Add Auth Directive Implementation

We will implement a simple directive transformer that wraps field resolvers.

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

Install utils:
```bash
npm install @graphql-tools/utils
```

---

# E) Update Context to decode JWT

Update `src/context.ts` to include `user`.

```ts
import jwt from "jsonwebtoken";
import type { Db } from "mongodb";
import DataLoader from "dataloader";

import { getDb } from "./db/mongo";
import { SimplePubSub } from "./pubsub";

export type AuthUser = { id: string; role: string };

export type GraphQLContext = {
  db: Db;
  user: AuthUser | null;
  loaders: {
    productLoader: DataLoader<string, any>;
  };
  pubsub: SimplePubSub;
};

const pubsubSingleton = new SimplePubSub();

function getUserFromAuthHeader(authHeader?: string): AuthUser | null {
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  try {
    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(token, secret) as any;
    return { id: decoded.id, role: decoded.role };
  } catch {
    return null;
  }
}

export async function buildContext(req?: any): Promise<GraphQLContext> {
  const db = await getDb();
  const user = getUserFromAuthHeader(req?.headers?.authorization);

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

✅ Key: context now depends on the request headers.

---

# F) Stitch User schema + apply directive transformer

Update `src/stitching/stitchedSchema.ts`:

```ts
import { stitchSchemas } from "@graphql-tools/stitch";
import { catalogSchema } from "../catalog/schema";
import { cartSchema } from "../cart/schema";
import { presenceSchema } from "../presence/schema";
import { userSchema } from "../user/schema";
import { authDirectiveTransformer } from "../auth/authDirective";

export const stitchedSchema = authDirectiveTransformer(
  stitchSchemas({
    subschemas: [catalogSchema, cartSchema, presenceSchema, userSchema],
  })
);
```

✅ Order matters:
- stitch schemas first
- then transform with directive wrappers

---

# G) Update Express middleware to pass req into context

In `src/index.ts`, update the HTTP middleware context:

```ts
app.use("/graphql", expressMiddleware(apollo, {
  context: async ({ req }) => buildContext(req),
}));
```

---

# H) Run & Test

Start:
```bash
npm run dev
```

## 1) Login (get token)
```graphql
mutation {
  login(userId: "u1", role: "USER")
}
```

Copy returned token.

## 2) Call me (requires auth)
In HTTP headers:
```
Authorization: Bearer <PASTE_TOKEN>
```

Query:
```graphql
query {
  me {
    id
    name
    email
    role
  }
}
```

## 3) Admin-only query
Try with USER token:
```graphql
query {
  adminStats
}
```
Expect FORBIDDEN.

Login as ADMIN:
```graphql
mutation {
  login(userId: "u2", role: "ADMIN")
}
```

Then:
```graphql
query {
  adminStats
}
```

✅ Works.

---

# Common Mistakes (Fast Fix)

### ❌ ctx.user is always null
You forgot to pass request into buildContext:
```ts
context: async ({ req }) => buildContext(req)
```

### ❌ Directive not working
You forgot to apply transformer AFTER stitching.

### ❌ JWT_SECRET undefined
Create `.env` and load it (if needed):
```bash
npm install dotenv
```
and at the top of `index.ts`:
```ts
import "dotenv/config";
```

---

# Module 7 Complete ✅

You now have:
- JWT auth in context
- `@auth` directive for RBAC
- Field-level authorization for sensitive fields

Next module preview:
- Error masking + extensions + requestId tracing (production observability)
