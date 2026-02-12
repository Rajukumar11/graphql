# Module 6 — MongoDB Integration + Aggregation (Ecommerce Cart)
## Updated Instruction File (Aligned with your **async buildContext()** + Stitched Schema + HTTP/WS server)

You clarified: **Module 6 is MongoDB** ✅  
This file is the **correct Module 6 instruction doc** that matches your current architecture:

- Apollo Server uses **stitchedSchema**
- `buildContext()` is **async**
- HTTP uses `expressMiddleware`
- WS uses `graphql-ws`
- MongoDB is used for **products + carts**
- Aggregation pipeline provides `cartSummary(cartId)`
- Fixes schema/resolver alignment so you never see:
  - `Query.CartItem defined in resolvers, but not in schema`
  - duplicate `Product` type errors

---

# 0) What you will build

By end of Module 6, you will have:

✅ MongoDB connected (Docker or local)  
✅ `products` collection seeded  
✅ `carts` collection persisted  
✅ Query: `cart(cartId)` returns items + resolves `CartItem.product` via DataLoader  
✅ Query: `cartSummary(cartId)` via Mongo aggregation pipeline  
✅ Mutations: `addToCart`, `removeFromCart`, `clearCart`  
✅ Works with your existing `index.ts` for HTTP + WS

---

# 1) Prerequisites

## 1.1 Run MongoDB (Docker recommended)

```bash
docker run -d --name mongo-cart -p 27017:27017 mongo:7
```

Verify:

```bash
docker ps
```

Optional (Mongo shell):

```bash
docker exec -it mongo-cart mongosh
```

---

# 2) Install MongoDB Driver

```bash
npm install mongodb
```

If TypeScript:

```bash
npm install -D @types/node
```

---

# 3) Create Mongo connection helper

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

  console.log("✅ Connected to MongoDB:", DB_NAME);
  return db;
}
```

---

# 4) Seed products into MongoDB (one-time)

Create: `src/db/seedProducts.ts`

```ts
import { getDb } from "./mongo";

type ProductDoc = {
  _id: string;     // string id: "p1"
  title: string;
  price: number;
};

async function seed() {
  const db = await getDb();
  const products = db.collection<ProductDoc>("products");

  const existing = await products.countDocuments();
  if (existing > 0) {
    console.log("ℹ️ Products already exist, skipping seed.");
    process.exit(0);
  }

  await products.insertMany([
    { _id: "p1", title: "T-Shirt", price: 499.0 },
    { _id: "p2", title: "Shoes", price: 1999.0 },
    { _id: "p3", title: "Cap", price: 299.0 },
  ]);

  console.log("✅ Seeded products into MongoDB.");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Add script:

```json
{
  "scripts": {
    "seed:products": "node --loader ts-node/esm src/db/seedProducts.ts"
  }
}
```

Run:

```bash
npm run seed:products
```

> If you don’t use ESM, adjust script to your current TS runner (ts-node-dev / tsx).

---

# 5) Update Context (async buildContext + Mongo + DataLoader + PubSub)

Update: `src/context.ts`

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
  userId?: string;
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

✅ Key rules:
- `buildContext()` is **async**
- DataLoader is **fresh per request/operation**
- PubSub is **singleton** per process

---

# 6) Cart TypeDefs (Mongo version)

Create/Update: `src/cart/typeDefs.ts`

## IMPORTANT: Avoid duplicate Product type
If Product is already defined in your Catalog schema, do NOT define it again here.

### Recommended Cart SDL
```ts
export const cartTypeDefs = `#graphql
  type CartItem {
    productId: ID!
    quantity: Int!
    product: Product
  }

  type Cart {
    id: ID!
    items: [CartItem!]!
  }

  type CartSummary {
    cartId: ID!
    totalItems: Int!
    totalPrice: Float!
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

  input ClearCartInput {
    cartId: ID!
  }

  extend type Query {
    cart(cartId: ID!): Cart!
    cartSummary(cartId: ID!): CartSummary!
  }

  extend type Mutation {
    addToCart(input: AddToCartInput!): Cart!
    removeFromCart(input: RemoveFromCartInput!): Cart!
    clearCart(input: ClearCartInput!): Cart!
  }
`;
```

---

# 7) Cart Resolvers (Mongo + Aggregation)

Create/Update: `src/cart/resolvers.ts`

```ts
import type { GraphQLContext } from "../context";

type CartItemDoc = { productId: string; quantity: number };

async function getOrCreateCart(ctx: GraphQLContext, cartId: string) {
  const carts = ctx.db.collection("carts");

  const existing = await carts.findOne({ cartId });
  if (existing) return existing;

  const created = { cartId, items: [] as CartItemDoc[] };
  await carts.insertOne(created);
  return created;
}

export const cartResolvers = {
  Query: {
    cart: async (_: unknown, args: { cartId: string }, ctx: GraphQLContext) => {
      const cart = await getOrCreateCart(ctx, args.cartId);
      return { id: cart.cartId, items: cart.items };
    },

    cartSummary: async (_: unknown, args: { cartId: string }, ctx: GraphQLContext) => {
      const pipeline = [
        { $match: { cartId: args.cartId } },
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
            _id: "$cartId",
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
  },

  // ✅ CRITICAL: CartItem resolver must be TOP LEVEL (NOT inside Query)
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

      const items = (cart.items as CartItemDoc[]) ?? [];
      const existing = items.find((i) => i.productId === productId);

      if (existing) existing.quantity += quantity;
      else items.push({ productId, quantity });

      await carts.updateOne({ cartId }, { $set: { items } });
      return { id: cartId, items };
    },

    removeFromCart: async (
      _: unknown,
      args: { input: { cartId: string; productId: string } },
      ctx: GraphQLContext
    ) => {
      const { cartId, productId } = args.input;
      const carts = ctx.db.collection("carts");
      const cart = await getOrCreateCart(ctx, cartId);

      const items = ((cart.items as CartItemDoc[]) ?? []).filter((i) => i.productId !== productId);
      await carts.updateOne({ cartId }, { $set: { items } });

      return { id: cartId, items };
    },

    clearCart: async (_: unknown, args: { input: { cartId: string } }, ctx: GraphQLContext) => {
      const { cartId } = args.input;
      const carts = ctx.db.collection("carts");
      await carts.updateOne({ cartId }, { $set: { items: [] } }, { upsert: true });
      return { id: cartId, items: [] };
    },
  },
};
```

---

# 8) Cart Schema (executable) for stitching

Create/Update: `src/cart/schema.ts`

```ts
import { makeExecutableSchema } from "@graphql-tools/schema";
import { cartTypeDefs } from "./typeDefs";
import { cartResolvers } from "./resolvers";

export const cartSchema = makeExecutableSchema({
  typeDefs: cartTypeDefs,
  resolvers: cartResolvers,
});
```

---

# 9) Stitch schemas (your project already does this)

Update `src/stitching/stitchedSchema.ts`

```ts
import { stitchSchemas } from "@graphql-tools/stitch";
import { catalogSchema } from "../catalog/schema";
import { cartSchema } from "../cart/schema";
import { presenceSchema } from "../presence/schema";

export const stitchedSchema = stitchSchemas({
  subschemas: [catalogSchema, cartSchema, presenceSchema],
});
```

---

# 10) Your `index.ts` MUST await buildContext for WS (fix applied)

In your current file, WS context must do:

```ts
context: async (ctx) => {
  const base = await buildContext(); // ✅ await
  const userId = (ctx.extra as any).userId as string | undefined;

  return { ...base, pubsub, userId };
},
```

If you don’t `await`, you can break db/loaders and get confusing runtime issues.

---

# 11) Run & Test

## 11.1 Start server
```bash
npm run dev
```

## 11.2 Mutations
Add items:
```graphql
mutation {
  addToCart(input: { cartId: "c10", productId: "p1", quantity: 2 }) {
    id
    items { productId quantity }
  }
}
```

Remove item:
```graphql
mutation {
  removeFromCart(input: { cartId: "c10", productId: "p1" }) {
    id
    items { productId quantity }
  }
}
```

Clear cart:
```graphql
mutation {
  clearCart(input: { cartId: "c10" }) {
    id
    items { productId quantity }
  }
}
```

## 11.3 Query cart with nested product
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

## 11.4 Query cart summary (aggregation)
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

# 12) Fast Fixes for Common Errors

## Duplicate Product type error
If both catalog and cart define `type Product`, remove one.
Keep Product in Catalog only.

## `Query.CartItem defined in resolvers...`
CartItem resolver must be top-level:
```ts
export const resolvers = {
  Query: {...},
  CartItem: {...} // ✅ top-level
}
```
Never nest `CartItem` inside `Query`.

## Product loader returns null
Run product seed:
```bash
npm run seed:products
```
Ensure `items.productId` matches `products._id`

---

# Module 6 Completed ✅
MongoDB + Aggregation is now correctly wired for your **async context + stitched schema + HTTP/WS** setup.
