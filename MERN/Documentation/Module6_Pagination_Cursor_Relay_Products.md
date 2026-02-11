
# Module 6 (Practical) — Pagination (Cursor-based + Relay Style) for Products

This module continues the **same Ecommerce Cart GraphQL project** and adds **production-grade pagination**.

✅ Module 6 focus:
- Cursor-based pagination (stable under inserts/deletes)
- Relay-style Connection spec (edges + pageInfo)
- Implement pagination for `productsConnection(first, after)`
- Works with MongoDB (fast with indexes)

We will paginate `products` collection.

---

## 1) WHAT we add

### Relay-style types
- `ProductConnection`
- `ProductEdge`
- `PageInfo`

### Query
```graphql
productsConnection(first: Int!, after: String): ProductConnection!
```

---

## 2) WHY cursor pagination (not offset)

Offset issues:
- duplicates/skips when new rows inserted
- slow at high offsets

Cursor benefits:
- stable ordering
- efficient with indexes
- ideal for infinite scrolling

---

## 3) WHEN to use Relay style
Use Relay-style when:
- you want consistent pagination shape across all lists
- you plan to build infinite scrolling UIs
- you want standardized `pageInfo`

---

# A) Add Relay Pagination Types to Schema

## 1) Update `src/catalog/typeDefs.ts`

Replace it with:

```ts
export const catalogTypeDefs = `#graphql
  type Product {
    id: ID!
    title: String!
    price: Float!
  }

  type PageInfo {
    endCursor: String
    hasNextPage: Boolean!
  }

  type ProductEdge {
    cursor: String!
    node: Product!
  }

  type ProductConnection {
    edges: [ProductEdge!]!
    pageInfo: PageInfo!
  }

  type Query {
    # old query (keep for now)
    products: [Product!]!

    # new relay-style pagination query
    productsConnection(first: Int!, after: String): ProductConnection!
  }
`;
```

---

# B) Implement Cursor Encoding Helpers

Create `src/catalog/pagination.ts`

```ts
export function encodeCursor(id: string): string {
  return Buffer.from(id, "utf8").toString("base64");
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, "base64").toString("utf8");
}
```

✅ For Module 6, cursor = base64(productId).  
Later you can encode multiple fields (createdAt + id).

---

# C) Implement productsConnection Resolver (Mongo)

## Update `src/catalog/resolvers.ts`

Replace file with:

```ts
import type { GraphQLContext } from "../context";
import { encodeCursor, decodeCursor } from "./pagination";

export const catalogResolvers = {
  Query: {
    products: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const rows = await ctx.db.collection("products").find().toArray();
      return rows.map((p: any) => ({ id: p._id, title: p.title, price: p.price }));
    },

    productsConnection: async (
      _: unknown,
      args: { first: number; after?: string },
      ctx: GraphQLContext
    ) => {
      const first = Math.max(1, Math.min(50, args.first)); // safety: 1..50
      const afterId = args.after ? decodeCursor(args.after) : null;

      // Cursor rule:
      // We sort by _id ASC for stable ordering.
      // If after is present, we fetch _id > afterId.
      const filter = afterId ? { _id: { $gt: afterId } } : {};

      // Fetch first + 1 to compute hasNextPage
      const rows = await ctx.db
        .collection("products")
        .find(filter)
        .sort({ _id: 1 })
        .limit(first + 1)
        .toArray();

      const hasNextPage = rows.length > first;
      const sliced = hasNextPage ? rows.slice(0, first) : rows;

      const edges = sliced.map((p: any) => ({
        cursor: encodeCursor(p._id),
        node: { id: p._id, title: p.title, price: p.price },
      }));

      const endCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;

      return {
        edges,
        pageInfo: {
          endCursor,
          hasNextPage,
        },
      };
    },
  },
};
```

✅ Key idea:
- cursor-based filter: `_id > afterId`
- `limit(first + 1)` to detect next page

---

# D) Add Mongo Index (Recommended)

In Mongo shell:

```js
use ecommerce_cart
db.products.createIndex({ _id: 1 })
```

✅ `_id` already has an index by default, so this is usually not needed.  
If you paginate by `createdAt`, you must index it.

---

# E) Run & Test

Start server:
```bash
npm run dev
```

## 1) First page
```graphql
query {
  productsConnection(first: 2) {
    edges {
      cursor
      node {
        id
        title
        price
      }
    }
    pageInfo {
      endCursor
      hasNextPage
    }
  }
}
```

Copy `endCursor`.

## 2) Next page (use after)
```graphql
query {
  productsConnection(first: 2, after: "PASTE_END_CURSOR_HERE") {
    edges {
      cursor
      node { id title price }
    }
    pageInfo {
      endCursor
      hasNextPage
    }
  }
}
```

---

# Common Mistakes (Fast Fix)

### ❌ Cursor decode fails
Your cursor must be base64 of the product ID string.
Don’t pass raw productId into `after`.

### ❌ Infinite loop / same page repeating
Make sure your filter uses `$gt` not `$gte`.

### ❌ Too large page size
Always clamp `first` (1..50).

---

# Module 6 Complete ✅

You now have:
- Cursor-based pagination
- Relay-style connection shape
- Mongo-backed paging with stable ordering
- Correct `hasNextPage` via `limit(first+1)`

Next module preview:
- Apollo Client cache merge (`relayStylePagination`)
- Persisted queries + CDN caching strategies
