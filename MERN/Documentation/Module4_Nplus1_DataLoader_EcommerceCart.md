# Module 4 (Practical) — N+1 Problem + DataLoader
## (Aligned to New Numbering + 4-Part Testing)
---

## WHAT
N+1 occurs when GraphQL executes:

1 parent resolver  
+ N child resolvers (one per item in list)

## WHY
GraphQL resolves fields independently.
Each nested field has its own resolver.

## WHEN
Dangerous when:
- Large lists
- Deep nesting
- DB calls are expensive
- Microservices are involved

---

# PART 1 — CODE CHANGES (Introduce N+1)

## Step 1 — Ensure shared product store exists

Create file: `src/catalog/store.ts`

```ts
export const products = [
  { id: "p1", title: "T-Shirt", price: 499 },
  { id: "p2", title: "Shoes", price: 1999 },
  { id: "p3", title: "Cap", price: 299 },
];

export function getProductById(id: string) {
  console.log("❌ DB HIT (single):", id);
  return products.find((p) => p.id === id) ?? null;
}

export function getProductsByIds(ids: readonly string[]) {
  console.log("📦 DB HIT (batch):", ids);
  const map = new Map(products.map((p) => [p.id, p]));
  return ids.map((id) => map.get(id) ?? null);
}
```

---

## Step 2 — Add nested product field in cart schema

Update `src/cart/typeDefs.ts`

```graphql
type CartItem {
  productId: ID!
  quantity: Int!
  product: Product
}
```

✅ If your stitched schema already defines `Product` in catalog schema, you don’t need to re-declare it.
If you get a “Product not found” error, add a minimal Product type temporarily in cart schema:

```graphql
type Product {
  id: ID!
  title: String!
  price: Float!
}
```

---

## Step 3 — Add naive resolver (causes N+1)

Update `src/cart/resolvers.ts`

```ts
import { getProductById } from "../catalog/store";

export const cartResolvers = {
  Query: { /* existing */ },
  Mutation: { /* existing */ },

  CartItem: {
    product: (parent: { productId: string }) => {
      return getProductById(parent.productId);
    },
  },
};
```

---

# PART 2 — FIX WITH DATALOADER

## WHAT
DataLoader batches multiple `.load(id)` calls into one batch call per request.

## WHY
Align GraphQL execution model with database batching model.

## WHEN
Use when resolving nested relations by ID repeatedly.

---

# PART 3 — CODE CHANGES (DataLoader Implementation)

## Step 1 — Install

```bash
npm install dataloader
```

---

## Step 2 — Create context with DataLoader

Create/Update `src/context.ts`

```ts
import DataLoader from "dataloader";
import { getProductsByIds } from "./catalog/store";

export type GraphQLContext = {
  loaders: {
    productLoader: DataLoader<string, any>;
  };
};

export function buildContext(): GraphQLContext {
  return {
    loaders: {
      productLoader: new DataLoader(async (ids) => {
        return getProductsByIds(ids);
      }),
    },
  };
}
```

IMPORTANT:
Create DataLoader **per request** (inside `buildContext`).

---

## Step 3 — Wire context in `src/index.ts`

```ts
import { buildContext } from "./context";

app.use("/graphql", expressMiddleware(server, {
  context: async () => buildContext(),
}));
```

---

## Step 4 — Replace naive resolver with loader

Update `src/cart/resolvers.ts`

```ts
import type { GraphQLContext } from "../context";

export const cartResolvers = {
  Query: { /* existing */ },
  Mutation: { /* existing */ },

  CartItem: {
    product: (
      parent: { productId: string },
      _: unknown,
      ctx: GraphQLContext
    ) => {
      return ctx.loaders.productLoader.load(parent.productId);
    },
  },
};
```

---

# PART 4 — TESTING (4 Parts)

Follow these tests in order. ✅

## Test Part 1 — Verify schema supports `product` field

Run this query:

```graphql
query {
  cart(cartId: "c1") {
    items {
      product {
        title
      }
    }
  }
}
```

Expected:
- ✅ If schema is correct → query validates (may still return null if resolver missing)
- ❌ If schema missing → error: `Cannot query field "product" on type "CartItem"`

---

## Test Part 2 — Prepare cart with multiple items

Run these mutations (Module 2):

```graphql
mutation {
  addToCart(input: { cartId: "c1", productId: "p1", quantity: 1 }) { id }
}
```

```graphql
mutation {
  addToCart(input: { cartId: "c1", productId: "p2", quantity: 1 }) { id }
}
```

```graphql
mutation {
  addToCart(input: { cartId: "c1", productId: "p3", quantity: 1 }) { id }
}
```

Expected:
- ✅ Returns cart id, no errors.

---

## Test Part 3 — Demonstrate N+1 (before DataLoader)

Make sure CartItem resolver is naive:

```ts
CartItem: {
  product: (parent) => getProductById(parent.productId)
}
```

Restart server:

```bash
Ctrl + C
npm run dev
```

Run query:

```graphql
query {
  cart(cartId: "c1") {
    id
    items {
      productId
      product {
        id
        title
        price
      }
    }
  }
}
```

Expected terminal logs (multiple):
```
❌ DB HIT (single): p1
❌ DB HIT (single): p2
❌ DB HIT (single): p3
```

✅ More items → more logs → N+1 confirmed.

---

## Test Part 4 — Verify DataLoader fix (after DataLoader)

Update resolver to use loader:

```ts
CartItem: {
  product: (parent, _, ctx) => ctx.loaders.productLoader.load(parent.productId)
}
```

Restart server:

```bash
Ctrl + C
npm run dev
```

Run same query again:

```graphql
query {
  cart(cartId: "c1") {
    id
    items {
      productId
      product { title }
    }
  }
}
```

Expected terminal logs (only ONE batch call):
```
📦 DB HIT (batch): [ 'p1', 'p2', 'p3' ]
```

---

# COMMON MISTAKES (Fast Fix)

❌ Creating DataLoader globally (shared across requests)  
✅ Must be created inside `buildContext()` (per request)

❌ Forgetting to wire context  
✅ Ensure `expressMiddleware(..., { context: async () => buildContext() })`

❌ Returning batch results in wrong order  
✅ Must return results in same order as `ids`

---

# MODULE 4 COMPLETE ✅

You now have:
- Real N+1 reproduction
- Correct DataLoader batching
- Proper per-request loader design
- 4-part testing checklist
