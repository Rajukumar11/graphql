
# Module 3 (Practical) — Input Types + N+1 Problem + DataLoader (Ecommerce Cart)

This module continues the **same project** (Module 1 → Module 2).

✅ Module 3 focus:
- Keep **input types** (already added in Module 2)
- Introduce the **N+1 problem** (why GraphQL can become slow)
- Fix it using **DataLoader** (batch + per-request cache)
- Add **CartItem.product: Product** so Cart can return real product details

No Mongo yet. No auth yet. Still in-memory.

---

## 1) WHAT we add

### A) Schema improvement
Cart now returns product details:

```graphql
type CartItem {
  productId: ID!
  quantity: Int!
  product: Product
}
```

### B) N+1 demonstration
When fetching a cart with many items, GraphQL will call `CartItem.product` resolver **once per item** → N calls.

### C) DataLoader fix
We batch product fetches into **one** call per request.

---

## 2) WHY this matters (Engineering)

GraphQL makes it easy to request nested data, but naive resolvers can cause:

- Too many DB calls (or service calls)
- Slow response time
- Higher costs

DataLoader is the standard solution:
- **Batch** many IDs into one load
- **Cache** results inside a single request

---

## 3) WHEN to use DataLoader

Use DataLoader when:
- A field resolver repeatedly fetches by ID (userId, productId, etc.)
- You see N+1 patterns in logs/metrics
- You build nested graphs like `Order → Items → Product`

Don’t use it for:
- Queries already returning everything in one call
- Cross-request cache (DataLoader is request-scoped)

---

# A) Install DataLoader

```bash
npm install dataloader
```

---

# B) Add a shared product store (Module 3 uses in-memory)

## Create `src/catalog/store.ts`
```ts
export type Product = { id: string; title: string; price: number };

export const products: Product[] = [
  { id: "p1", title: "T-Shirt", price: 499.0 },
  { id: "p2", title: "Shoes", price: 1999.0 },
  { id: "p3", title: "Cap", price: 299.0 },
];

export function getProductsByIds(ids: readonly string[]) {
  // Simulate "DB call"
  console.log("📦 getProductsByIds called with:", ids);

  const map = new Map(products.map((p) => [p.id, p]));
  return ids.map((id) => map.get(String(id)) ?? null);
}
```

✅ Why this file?
- It simulates a “database/service” so you can *see* batching.
- Later you’ll replace it with Mongo.

---

# C) Update Catalog resolvers to use the shared store

## Update `src/catalog/resolvers.ts`
Replace the file with:

```ts
import { products } from "./store";

export const catalogResolvers = {
  Query: {
    products: () => products,
  },
};
```

---

# D) Add GraphQL Context (to hold loaders)

## Create `src/context.ts`
```ts
import DataLoader from "dataloader";
import { getProductsByIds } from "./catalog/store";

export type GraphQLContext = {
  loaders: {
    productLoader: DataLoader<string, any>;
  };
};

export function buildContext(): GraphQLContext {
  const productLoader = new DataLoader<string, any>(async (ids) => {
    // Batch function (one call for many IDs)
    return getProductsByIds(ids);
  });

  return { loaders: { productLoader } };
}
```

✅ Key rule:
- Create loaders **per request** (not global).

---

# E) Extend Cart schema with Product type + CartItem.product

## Update `src/cart/typeDefs.ts`
Replace with:

```ts
export const cartTypeDefs = `#graphql
  # NOTE: Product type is defined in Catalog schema.
  # For stitching, we can also define it here as a "stub" if needed,
  # but in this simple demo we just reference it by name.

  type CartItem {
    productId: ID!
    quantity: Int!
    product: Product
  }

  type Cart {
    id: ID!
    items: [CartItem!]!
  }

  input AddToCartInput {
    cartId: ID!
    productId: ID!
    quantity: Int!
  }

  input RemoveFromCartInput {
    cartId: ID!
    productId: ID!
  }

  type Query {
    cart(cartId: ID!): Cart!
  }

  type Mutation {
    addToCart(input: AddToCartInput!): Cart!
    removeFromCart(input: RemoveFromCartInput!): Cart!
    clearCart(cartId: ID!): Cart!
  }
`;
```

---

# F) Add the N+1 resolver first (to understand the problem)

## Update `src/cart/resolvers.ts`

### 1) Add this import at top
```ts
import type { GraphQLContext } from "../context";
import { products } from "../catalog/store";
```

### 2) Add a naive product resolver (N+1)
Inside your `export const cartResolvers = { ... }`, add:

```ts
CartItem: {
  product: (parent: { productId: string }) => {
    // ❌ NAIVE: runs once per cart item (N+1)
    console.log("❌ N+1 product resolver hit for:", parent.productId);
    return products.find((p) => p.id === parent.productId) ?? null;
  },
},
```

✅ Now test with a cart that has many items — you will see many logs.

---

# G) Fix N+1 using DataLoader (the correct way)

Replace the naive resolver with this DataLoader-based resolver:

```ts
CartItem: {
  product: (parent: { productId: string }, _: unknown, ctx: GraphQLContext) => {
    // ✅ Batched + cached within request
    return ctx.loaders.productLoader.load(parent.productId);
  },
},
```

✅ What changes?
- Instead of N product lookups, DataLoader batches IDs into 1 call:
  `getProductsByIds([p1, p2, p3])`

---

# H) Wire context into Apollo Server (Express)

## Update `src/index.ts`

1) Import the context builder:
```ts
import { buildContext } from "./context";
```

2) Pass context to expressMiddleware:

```ts
app.use("/graphql", expressMiddleware(server, {
  context: async () => buildContext()
}));
```

That’s it.

---

# I) Testing (copy-paste)

## 1) Create a cart with multiple items (mutations)
```graphql
mutation {
  addToCart(input: { cartId: "c2", productId: "p1", quantity: 1 }) { id }
}
```

```graphql
mutation {
  addToCart(input: { cartId: "c2", productId: "p2", quantity: 1 }) { id }
}
```

```graphql
mutation {
  addToCart(input: { cartId: "c2", productId: "p3", quantity: 1 }) { id }
}
```

## 2) Query cart with nested products
```graphql
query {
  cart(cartId: "c2") {
    id
    items {
      productId
      quantity
      product {
        id
        title
        price
      }
    }
  }
}
```

### Expected console behavior
With DataLoader, you should see **one** batch call:
- `📦 getProductsByIds called with: [p1, p2, p3]`

Not many individual calls.

---

# Common Mistakes (Fast Fix)

### ❌ Creating DataLoader globally (shared across users)
DataLoader must be created **per request**, otherwise:
- cache leaks across users
- stale results

### ❌ Forgetting to pass context into `expressMiddleware`
If `ctx` is undefined, you didn’t wire context correctly.

### ❌ Using DataLoader but still doing DB calls in field resolver
The whole point is: field resolver calls `.load(id)` only.

---

# Module 3 Complete ✅

You now have:
- Input types used for mutations (clean API)
- Cart returns nested Product data
- You understand N+1 and how it happens
- DataLoader fixes N+1 using batching + per-request caching

Next module preview:
- Replace in-memory store with **Mongo**
- Use Mongo aggregation where needed
- Keep DataLoader for nested fetches
