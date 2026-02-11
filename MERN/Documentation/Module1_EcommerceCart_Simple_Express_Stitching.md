
# Module 1 (Practical) — Ecommerce Cart: Apollo Server Setup (Express) + Schema Stitching (Simple)

This is the **first practical module**. Keep it simple:
- **Apollo Server v5**
- **Express integration**
- **Schema stitching**
- **Basic schema + basic resolvers** (in-memory data)

✅ Output:
- GraphQL Playground/Explorer at: `http://localhost:4000/graphql`
- One unified schema that contains:
  - **Catalog** (Query: products)
  - **Cart** (Query: cart, Mutation: addToCart)

---

## 1) What we are building (WHAT)
A single GraphQL endpoint that stitches two small schemas:
- `catalog` schema (products)
- `cart` schema (cart + add item)

## 2) Why we are doing this (WHY)
- Learn clean separation: **Catalog ≠ Cart**
- Learn how one endpoint can combine multiple schemas
- Foundation for later modules (auth, DB, DataLoader, pagination, etc.)

## 3) When to use stitching (WHEN)
Use stitching when you want:
- modular domains
- one endpoint
- fast composition of schemas

(For large companies/microservices later, you’ll also learn Federation — not now.)

---

# A) Setup (Step-by-step)

## 0) Prerequisites
- Node.js 18+
- npm

Check:
```bash
node -v
npm -v
```

## 1) Create project
```bash
mkdir ecommerce-cart-graphql
cd ecommerce-cart-graphql
npm init -y
```

## 2) Install dependencies

### Runtime
```bash
npm install express cors body-parser graphql @apollo/server @as-integrations/express5
npm install @graphql-tools/schema @graphql-tools/stitch
```

### Dev tools
```bash
npm install -D typescript ts-node-dev @types/node @types/express @types/cors
```

## 3) TypeScript config
```bash
npx tsc --init
```

Update `tsconfig.json` (important for Apollo v5):
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## 4) Add scripts (package.json)
Replace scripts with:
```json
"scripts": {
  "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

---

# B) Project Structure

Create folders:
```bash
mkdir -p src/catalog src/cart src/stitching
```

Final structure (Module 1):
```
src/
  index.ts
  catalog/
    typeDefs.ts
    resolvers.ts
    schema.ts
  cart/
    typeDefs.ts
    resolvers.ts
    schema.ts
  stitching/
    stitchedSchema.ts
```

---

# C) Catalog schema (Basics)

## 1) `src/catalog/typeDefs.ts`
```ts
export const catalogTypeDefs = `#graphql
  type Product {
    id: ID!
    title: String!
    price: Float!
  }

  type Query {
    products: [Product!]!
  }
`;
```

## 2) `src/catalog/resolvers.ts`
```ts
const products = [
  { id: "p1", title: "T-Shirt", price: 499.0 },
  { id: "p2", title: "Shoes", price: 1999.0 },
];

export const catalogResolvers = {
  Query: {
    products: () => products,
  },
};
```

## 3) `src/catalog/schema.ts`
```ts
import { makeExecutableSchema } from "@graphql-tools/schema";
import { catalogTypeDefs } from "./typeDefs";
import { catalogResolvers } from "./resolvers";

export const catalogSchema = makeExecutableSchema({
  typeDefs: catalogTypeDefs,
  resolvers: catalogResolvers,
});
```

---

# D) Cart schema (Basics)

## 1) `src/cart/typeDefs.ts`
```ts
export const cartTypeDefs = `#graphql
  type CartItem {
    productId: ID!
    quantity: Int!
  }

  type Cart {
    id: ID!
    items: [CartItem!]!
  }

  type Query {
    cart(cartId: ID!): Cart!
  }

  type Mutation {
    addToCart(cartId: ID!, productId: ID!, quantity: Int!): Cart!
  }
`;
```

## 2) `src/cart/resolvers.ts`
```ts
type CartItem = { productId: string; quantity: number };
type Cart = { id: string; items: CartItem[] };

const carts = new Map<string, Cart>();

function getOrCreateCart(cartId: string): Cart {
  const existing = carts.get(cartId);
  if (existing) return existing;
  const created: Cart = { id: cartId, items: [] };
  carts.set(cartId, created);
  return created;
}

export const cartResolvers = {
  Query: {
    cart: (_: unknown, args: { cartId: string }) => getOrCreateCart(args.cartId),
  },

  Mutation: {
    addToCart: (
      _: unknown,
      args: { cartId: string; productId: string; quantity: number }
    ) => {
      const cart = getOrCreateCart(args.cartId);
      const qty = Math.max(1, args.quantity); // basic guard

      const item = cart.items.find((i) => i.productId === args.productId);
      if (item) item.quantity += qty;
      else cart.items.push({ productId: args.productId, quantity: qty });

      return cart;
    },
  },
};
```

## 3) `src/cart/schema.ts`
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

# E) Schema Stitching (Simple)

## `src/stitching/stitchedSchema.ts`
```ts
import { stitchSchemas } from "@graphql-tools/stitch";
import { catalogSchema } from "../catalog/schema";
import { cartSchema } from "../cart/schema";

export const stitchedSchema = stitchSchemas({
  subschemas: [catalogSchema, cartSchema],
});
```

✅ Result: one schema with combined `Query` and `Mutation`.

---

# F) Express + Apollo Server Setup

## `src/index.ts`
```ts
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";

import { stitchedSchema } from "./stitching/stitchedSchema";

async function start() {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  const server = new ApolloServer({ schema: stitchedSchema });
  await server.start();

  app.use("/graphql", expressMiddleware(server));

  const port = 4000;
  app.listen(port, () => {
    console.log(`🚀 GraphQL ready at: http://localhost:${port}/graphql`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

---

# G) Run Module 1

```bash
npm run dev
```

Open:
- `http://localhost:4000/graphql`

---

# H) Test (Copy-Paste)

## 1) Products
```graphql
query {
  products {
    id
    title
    price
  }
}
```

## 2) Cart query
```graphql
query {
  cart(cartId: "c1") {
    id
    items {
      productId
      quantity
    }
  }
}
```

## 3) Add to cart
```graphql
mutation {
  addToCart(cartId: "c1", productId: "p1", quantity: 2) {
    id
    items {
      productId
      quantity
    }
  }
}
```

---

# Common Setup Errors (Quick Fix)

### Error: Cannot find module '@as-integrations/express5'
```bash
npm install @as-integrations/express5
```

### Error: ESM / import issues
Confirm in `tsconfig.json`:
- `"module": "NodeNext"`
- `"moduleResolution": "NodeNext"`

---

# Module 1 Complete ✅

You now have:
- Express + Apollo Server running
- Two small schemas (Catalog + Cart)
- One stitched GraphQL endpoint

Next module will add:
- better inputs (`AddToCartInput`)
- linking Cart items to Product
- DataLoader (N+1 fix)
