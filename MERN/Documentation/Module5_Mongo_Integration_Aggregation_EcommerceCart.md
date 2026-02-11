
# Module 5 (Practical) — Mongo Integration + Aggregation Inside Resolvers (Ecommerce Cart)

This module continues the **same project** (Modules 1→4) and adds **MongoDB**.

✅ Module 5 focus:
- Connect Apollo Server (Express) to **MongoDB**
- Replace in-memory carts with Mongo collections
- Add **aggregation pipelines inside resolvers** for analytics-style queries
- Keep it practical and incremental

We will implement:
- `Query.cart(cartId)` from Mongo
- `Mutation.addToCart(...)` persists to Mongo
- `Query.cartSummary(cartId)` using **aggregation** to compute totals

---

## 1) WHAT we add

### A) MongoDB connection
- One MongoClient for the app
- Inject `db` into GraphQL context

### B) Collections
- `products` (seeded)
- `carts` (stores cart documents)

### C) Aggregation inside resolvers
Use Mongo Aggregation Framework to compute:
- total items
- total price (qty * price)

---

## 2) WHY aggregation inside resolvers
GraphQL often powers dashboards and summary views. Aggregation:
- avoids multiple queries in resolvers
- reduces CPU work in Node
- lets Mongo do computation efficiently

---

## 3) WHEN to use aggregation
Use aggregation when:
- you need grouped/summarized metrics
- you need join-like behavior ($lookup)
- you want to compute totals efficiently

Avoid it when:
- a simple find() is enough
- the pipeline becomes too complex (move to service layer later)

---

# A) Prerequisites

## 1) Start MongoDB
If you have MongoDB installed locally, start it.

**OR** use Docker (recommended):
```bash
docker run -d --name mongo-cart -p 27017:27017 mongo:7
```

Check:
```bash
mongosh
```

---

# B) Install Mongo driver
```bash
npm install mongodb
```

---

# C) Create Mongo connection helper

Create: `src/db/mongo.ts`
```ts
import { MongoClient, Db } from "mongodb";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "ecommerce_cart";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);

  console.log("✅ Connected to Mongo:", DB_NAME);
  return db;
}
```

---

# D) Seed products into Mongo (one-time)

Create: `src/db/seed.ts`
```ts
import { getDb } from "./mongo";

async function seed() {
  const db = await getDb();
  const products = db.collection("products");

  const existing = await products.countDocuments();
  if (existing > 0) {
    console.log("ℹ️ Products already seeded.");
    process.exit(0);
  }

  await products.insertMany([
    { _id: "p1", title: "T-Shirt", price: 499.0 },
    { _id: "p2", title: "Shoes", price: 1999.0 },
    { _id: "p3", title: "Cap", price: 299.0 },
  ]);

  console.log("✅ Seeded products.");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Add script in `package.json`:
```json
"seed": "ts-node-dev --transpile-only src/db/seed.ts"
```

Run seed:
```bash
npm run seed
```

---

# E) Update GraphQL Context to include db

Update `src/context.ts` (from Module 4) to include Mongo db.

```ts
import DataLoader from "dataloader";
import type { Db } from "mongodb";
import { getDb } from "./db/mongo";
import { SimplePubSub } from "./pubsub";

export type GraphQLContext = {
  db: Db;
  loaders: {
    productLoader: DataLoader<string, any>;
  };
  pubsub: SimplePubSub;
};

const pubsubSingleton = new SimplePubSub();

export async function buildContext(): Promise<GraphQLContext> {
  const db = await getDb();

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
    loaders: { productLoader },
    pubsub: pubsubSingleton,
  };
}

export function getPubSub() {
  return pubsubSingleton;
}
```

✅ Important:
- DataLoader now reads products from Mongo
- `buildContext()` is async

---

# F) Update Express middleware to use async buildContext

In `src/index.ts`, ensure context is:

```ts
app.use("/graphql", expressMiddleware(apollo, {
  context: async () => buildContext(),
}));
```

---

# G) Update Catalog resolvers to read products from Mongo

Update `src/catalog/resolvers.ts`:

```ts
import type { GraphQLContext } from "../context";

export const catalogResolvers = {
  Query: {
    products: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const rows = await ctx.db.collection("products").find().toArray();
      // Map Mongo _id -> GraphQL id
      return rows.map((p: any) => ({ id: p._id, title: p.title, price: p.price }));
    },
  },
};
```

---

# H) Store carts in Mongo

We store cart as:
```js
{ _id: "c1", items: [{ productId: "p1", quantity: 2 }] }
```

Update `src/cart/resolvers.ts` (Mongo-backed cart):

```ts
import type { GraphQLContext } from "../context";

type CartItem = { productId: string; quantity: number };

async function getOrCreateCart(ctx: GraphQLContext, cartId: string) {
  const carts = ctx.db.collection("carts");

  const existing = await carts.findOne({ _id: cartId });
  if (existing) return existing;

  const created = { _id: cartId, items: [] as CartItem[] };
  await carts.insertOne(created);
  return created;
}

export const cartResolvers = {
  Query: {
    cart: async (_: unknown, args: { cartId: string }, ctx: GraphQLContext) => {
      const cart = await getOrCreateCart(ctx, args.cartId);
      return { id: cart._id, items: cart.items };
    },
  },

  CartItem: {
    product: (parent: { productId: string }, _: unknown, ctx: GraphQLContext) => {
      return ctx.loaders.productLoader.load(parent.productId);
    },
  },

  Mutation: {
    addToCart: async (
      _: unknown,
      args: { input: { cartId: string; productId: string; quantity: number } },
      ctx: GraphQLContext
    ) => {
      const { cartId, productId } = args.input;
      const quantity = Math.max(1, args.input.quantity);

      const carts = ctx.db.collection("carts");
      const cart = await getOrCreateCart(ctx, cartId);

      const items = cart.items as CartItem[];
      const existing = items.find((i) => i.productId === productId);
      if (existing) existing.quantity += quantity;
      else items.push({ productId, quantity });

      await carts.updateOne({ _id: cartId }, { $set: { items } });

      return { id: cartId, items };
    },
  },
};
```

---

# I) Add Aggregation Query: cartSummary(cartId)

We compute:
- totalItems (sum of quantities)
- totalPrice (qty * price)

## 1) Update `src/cart/typeDefs.ts`

Add this type:
```graphql
type CartSummary {
  cartId: ID!
  totalItems: Int!
  totalPrice: Float!
}
```

Add query field:
```graphql
type Query {
  cart(cartId: ID!): Cart!
  cartSummary(cartId: ID!): CartSummary!
}
```

## 2) Add resolver with aggregation pipeline

In `src/cart/resolvers.ts`, add under `Query`:

```ts
cartSummary: async (_: unknown, args: { cartId: string }, ctx: GraphQLContext) => {
  const pipeline = [
    { $match: { _id: args.cartId } },
    { $unwind: "$items" },
    {
      $lookup: {
        from: "products",
        localField: "items.productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $group: {
        _id: "$_id",
        totalItems: { $sum: "$items.quantity" },
        totalPrice: { $sum: { $multiply: ["$items.quantity", "$product.price"] } },
      },
    },
    {
      $project: {
        _id: 0,
        cartId: "$_id",
        totalItems: 1,
        totalPrice: 1,
      },
    },
  ];

  const rows = await ctx.db.collection("carts").aggregate(pipeline).toArray();

  if (rows.length === 0) return { cartId: args.cartId, totalItems: 0, totalPrice: 0 };
  return rows[0];
},
```

✅ This is **aggregation inside the resolver**.

---

# J) Run & Test

Start server:
```bash
npm run dev
```

## 1) Add items
```graphql
mutation {
  addToCart(input: { cartId: "c10", productId: "p1", quantity: 2 }) {
    id
    items { productId quantity }
  }
}
```

```graphql
mutation {
  addToCart(input: { cartId: "c10", productId: "p2", quantity: 1 }) {
    id
  }
}
```

## 2) Query cart (with nested product)
```graphql
query {
  cart(cartId: "c10") {
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

## 3) Query summary (aggregation)
```graphql
query {
  cartSummary(cartId: "c10") {
    cartId
    totalItems
    totalPrice
  }
}
```

---

# Common Mistakes (Fast Fix)

### ❌ Mongo not running
If using Docker:
```bash
docker ps
docker start mongo-cart
```

### ❌ Product lookup empty in aggregation
Ensure you ran:
```bash
npm run seed
```
and your product IDs match `items.productId`.

### ❌ buildContext changed to async but called sync
Ensure middleware is:
```ts
context: async () => buildContext()
```

---

# Module 5 Complete ✅

You now have:
- Mongo integrated into context
- Products in Mongo (seeded)
- Cart in Mongo (persisted)
- DataLoader reading products from Mongo
- Aggregation inside resolver (`cartSummary`)
