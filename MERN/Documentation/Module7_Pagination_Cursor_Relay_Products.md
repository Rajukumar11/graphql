# Module 7 — Pagination Implementation Plan (No-Break for Module 6)
## Cursor-based + Relay-style, aligned with your Stitched Schema + Mongo + Async Context

This instruction file tells you **exactly what to add** for Module 7 while keeping Module 6 (Mongo cart + aggregation) working unchanged.

---

# 0) No-break rules (Read this first)

✅ Do **NOT** modify Module 6 files:
- `src/cart/*`
- `src/db/mongo.ts`
- `src/context.ts` (only if absolutely necessary; in this plan, NO changes)
- existing stitched subschemas (catalog/cart/presence)

✅ Module 7 will be added as a **new module**:
- `src/pagination/*`

✅ Only one existing file will change:
- `src/stitching/stitchedSchema.ts` (add one subschema)

---

# 1) Baseline verification (Module 6 must pass before Module 7)

Run these Module 6 tests first (quick regression):

## 1.1 Add to cart
```graphql
mutation {
  addToCart(input: { cartId: "c10", productId: "p1", quantity: 2 }) {
    id
    items { productId quantity }
  }
}
```

## 1.2 Query cart
```graphql
query {
  cart(cartId: "c10") {
    id
    items {
      productId
      quantity
      product { id title price }
    }
  }
}
```

## 1.3 Query cartSummary (aggregation)
```graphql
query {
  cartSummary(cartId: "c10") {
    cartId
    totalItems
    totalPrice
  }
}
```

If these pass, proceed.

---

# 2) Create Module 7 folder

```bash
mkdir -p src/pagination
```

You will add 3 files:

- `src/pagination/typeDefs.ts`
- `src/pagination/resolvers.ts`
- `src/pagination/schema.ts`

---

# 3) Add Module 7 TypeDefs (Cursor + Relay)

Create: `src/pagination/typeDefs.ts`

> IMPORTANT: Because you use **stitched subschemas**, each subschema should define its own `type Query`.
> Do NOT use `extend type Query` here to avoid “Cannot extend type Query because it is not defined”.

```ts
export const paginationTypeDefs = `#graphql
  scalar Cursor

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: Cursor
    endCursor: Cursor
  }

  # Non-relay (cursor pagination)
  type ProductsCursorPage {
    items: [Product!]!
    nextCursor: Cursor
    hasNextPage: Boolean!
  }

  # Relay connection types
  type ProductEdge {
    cursor: Cursor!
    node: Product!
  }

  type ProductConnection {
    edges: [ProductEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type Query {
    # Part 1: Cursor pagination (forward only)
    productsCursor(first: Int!, after: Cursor): ProductsCursorPage!

    # Part 2: Relay pagination (forward/backward)
    productsConnection(
      first: Int
      after: Cursor
      last: Int
      before: Cursor
    ): ProductConnection!
  }
`;
```

✅ This does not affect Module 6 queries/mutations.

---

# 4) Add Module 7 Resolvers (Mongo-based)

Create: `src/pagination/resolvers.ts`

> Assumption (aligned with Module 6):
> - products collection uses string `_id` like `"p1"`, `"p2"`.
> - Sorting on `_id` is stable for this demo.
> If you later move to ObjectId, update cursor decode to ObjectId.

```ts
import type { GraphQLContext } from "../context";

function encodeCursor(id: string) {
  return Buffer.from(id, "utf8").toString("base64");
}

function decodeCursor(cursor: string) {
  return Buffer.from(cursor, "base64").toString("utf8");
}

const MAX_PAGE = 50;

export const paginationResolvers = {
  Query: {
    // -----------------------------
    // Part 1: Cursor pagination (forward)
    // -----------------------------
    productsCursor: async (
      _: unknown,
      args: { first: number; after?: string },
      ctx: GraphQLContext
    ) => {
      const first = Math.min(Math.max(args.first, 1), MAX_PAGE);
      const filter: any = {};

      if (args.after) {
        filter._id = { $gt: decodeCursor(args.after) };
      }

      const rows = await ctx.db
        .collection("products")
        .find(filter)
        .sort({ _id: 1 })
        .limit(first + 1)
        .toArray();

      const hasNextPage = rows.length > first;
      const sliced = rows.slice(0, first);

      const nextCursor = sliced.length > 0 ? encodeCursor(String(sliced[sliced.length - 1]._id)) : null;

      // NOTE: Map to your Product shape (id/title/price)
      const items = sliced.map((p: any) => ({
        id: String(p._id),
        title: p.title,
        price: p.price,
      }));

      return {
        items,
        nextCursor,
        hasNextPage,
      };
    },

    // -----------------------------
    // Part 2: Relay connection
    // -----------------------------
    productsConnection: async (
      _: unknown,
      args: { first?: number; after?: string; last?: number; before?: string },
      ctx: GraphQLContext
    ) => {
      const first = args.first ?? undefined;
      const last = args.last ?? undefined;

      // Relay rule: provide exactly one of first/last
      if ((first && last) || (!first && !last)) {
        throw new Error("Provide exactly one of `first` or `last`.");
      }

      const limitRequested = first ?? last ?? 10;
      const limit = Math.min(Math.max(limitRequested, 1), MAX_PAGE);

      const filter: any = {};

      // Forward
      if (first) {
        if (args.after) {
          filter._id = { $gt: decodeCursor(args.after) };
        }

        const rows = await ctx.db
          .collection("products")
          .find(filter)
          .sort({ _id: 1 })
          .limit(limit + 1)
          .toArray();

        const hasNextPage = rows.length > limit;
        const sliced = rows.slice(0, limit);

        const edges = sliced.map((p: any) => ({
          cursor: encodeCursor(String(p._id)),
          node: { id: String(p._id), title: p.title, price: p.price },
        }));

        return {
          edges,
          pageInfo: {
            hasNextPage,
            hasPreviousPage: !!args.after,
            startCursor: edges[0]?.cursor ?? null,
            endCursor: edges.length ? edges[edges.length - 1].cursor : null,
          },
          totalCount: await ctx.db.collection("products").countDocuments({}),
        };
      }

      // Backward
      if (last) {
        if (args.before) {
          filter._id = { $lt: decodeCursor(args.before) };
        }

        const rows = await ctx.db
          .collection("products")
          .find(filter)
          .sort({ _id: -1 })
          .limit(limit + 1)
          .toArray();

        const hasPreviousPage = rows.length > limit;
        const slicedDesc = rows.slice(0, limit);
        const sliced = slicedDesc.reverse(); // return ascending

        const edges = sliced.map((p: any) => ({
          cursor: encodeCursor(String(p._id)),
          node: { id: String(p._id), title: p.title, price: p.price },
        }));

        return {
          edges,
          pageInfo: {
            hasNextPage: !!args.before,
            hasPreviousPage,
            startCursor: edges[0]?.cursor ?? null,
            endCursor: edges.length ? edges[edges.length - 1].cursor : null,
          },
          totalCount: await ctx.db.collection("products").countDocuments({}),
        };
      }
    },
  },
};
```

---

# 5) Create pagination executable schema (for stitching)

Create: `src/pagination/schema.ts`

```ts
import { makeExecutableSchema } from "@graphql-tools/schema";
import { paginationTypeDefs } from "./typeDefs";
import { paginationResolvers } from "./resolvers";

export const paginationSchema = makeExecutableSchema({
  typeDefs: paginationTypeDefs,
  resolvers: paginationResolvers,
});
```

---

# 6) Stitch Module 7 into stitchedSchema (ONLY change needed)

Update: `src/stitching/stitchedSchema.ts`

Add this import:

```ts
import { paginationSchema } from "../pagination/schema";
```

Then add it to the `subschemas` list:

```ts
export const stitchedSchema = stitchSchemas({
  subschemas: [
    catalogSchema,
    cartSchema,
    presenceSchema,
    paginationSchema, // ✅ Module 7 added
  ],
});
```

✅ Existing schemas continue working unchanged.

---

# 7) Testing (separate tests for each implementation)

## Test A — Cursor pagination (Part 1)

### A1) First page
```graphql
query {
  productsCursor(first: 2) {
    items { id title price }
    nextCursor
    hasNextPage
  }
}
```

Copy `nextCursor`.

### A2) Next page
```graphql
query {
  productsCursor(first: 2, after: "PASTE_NEXT_CURSOR") {
    items { id title price }
    nextCursor
    hasNextPage
  }
}
```

✅ Verify:
- no duplicates across pages
- hasNextPage becomes false at end

---

## Test B — Relay pagination (Part 2)

### B1) First page
```graphql
query {
  productsConnection(first: 2) {
    edges { cursor node { id title price } }
    pageInfo { hasNextPage endCursor }
    totalCount
  }
}
```

Copy `endCursor`.

### B2) Next page
```graphql
query {
  productsConnection(first: 2, after: "PASTE_END_CURSOR") {
    edges { cursor node { id title price } }
    pageInfo { hasNextPage endCursor }
  }
}
```

### B3) Backward page (optional)
Use any edge cursor from B2 and run:

```graphql
query {
  productsConnection(last: 2, before: "PASTE_EDGE_CURSOR") {
    edges { cursor node { id title price } }
    pageInfo { hasPreviousPage startCursor endCursor }
  }
}
```

---

# 8) Regression Test (Module 6 must still pass)

Re-run Module 6 tests after adding Module 7:

- addToCart
- cart
- cartSummary

If these pass, Module 7 is integrated without breaking existing functionality.

---

# DONE ✅
Module 7 pagination is now added cleanly as a new stitched subschema, keeping Module 6 intact.
