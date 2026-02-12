# 🛒 Module 1 --- Ecommerce Cart

## Apollo Server (Express) + Schema Stitching (Query Only)

This is the first practical module.

We focus ONLY on:

-   Apollo Server setup
-   Express integration
-   Basic GraphQL schema
-   Basic resolvers
-   Schema stitching
-   Read operations (Query only)

No mutation. No DB. No auth.

------------------------------------------------------------------------

# 🎯 What We Are Building

A single GraphQL endpoint:

http://localhost:4000/graphql

That stitches two schemas:

-   Catalog schema → products
-   Cart schema → cart (read-only)

------------------------------------------------------------------------

# 📦 Step 1 --- Create Project

``` bash
mkdir ecommerce-cart-graphql
cd ecommerce-cart-graphql
npm init -y
```

------------------------------------------------------------------------

# 📦 Step 2 --- Install Dependencies

### Runtime

``` bash
npm install express cors body-parser graphql @apollo/server @as-integrations/express5
npm install @graphql-tools/schema @graphql-tools/stitch
```

### Dev

``` bash
npm install -D typescript ts-node-dev @types/node @types/express @types/cors
```

------------------------------------------------------------------------

# ⚙️ Step 3 --- Configure package.json Scripts

Open `package.json` and update the `"scripts"` section to:

``` json
"scripts": {
  "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

Explanation:

-   **dev** → Runs project in development mode with auto-restart
-   **build** → Compiles TypeScript into `/dist`
-   **start** → Runs compiled production build

------------------------------------------------------------------------

# ⚙️ Step 4 --- TypeScript Setup

``` bash
npx tsc --init
```

Update `tsconfig.json`:

``` json
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

------------------------------------------------------------------------

# 📁 Step 5 --- Project Structure

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

------------------------------------------------------------------------

# 🏷 Catalog Schema

## src/catalog/typeDefs.ts

``` ts
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

## src/catalog/resolvers.ts

``` ts
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

## src/catalog/schema.ts

``` ts
import { makeExecutableSchema } from "@graphql-tools/schema";
import { catalogTypeDefs } from "./typeDefs";
import { catalogResolvers } from "./resolvers";

export const catalogSchema = makeExecutableSchema({
  typeDefs: catalogTypeDefs,
  resolvers: catalogResolvers,
});
```

------------------------------------------------------------------------

# 🛒 Cart Schema

## src/cart/typeDefs.ts

``` ts
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
`;
```

## src/cart/resolvers.ts

``` ts
type CartItem = { productId: string; quantity: number };
type Cart = { id: string; items: CartItem[] };

const carts = new Map<string, Cart>();

carts.set("c1", {
  id: "c1",
  items: [{ productId: "p1", quantity: 2 }]
});

export const cartResolvers = {
  Query: {
    cart: (_: unknown, args: { cartId: string }) => {
      return carts.get(args.cartId) ?? { id: args.cartId, items: [] };
    },
  },
};
```

## src/cart/schema.ts

``` ts
import { makeExecutableSchema } from "@graphql-tools/schema";
import { cartTypeDefs } from "./typeDefs";
import { cartResolvers } from "./resolvers";

export const cartSchema = makeExecutableSchema({
  typeDefs: cartTypeDefs,
  resolvers: cartResolvers,
});
```

------------------------------------------------------------------------

# 🔗 Stitch Schemas

## src/stitching/stitchedSchema.ts

``` ts
import { stitchSchemas } from "@graphql-tools/stitch";
import { catalogSchema } from "../catalog/schema";
import { cartSchema } from "../cart/schema";

export const stitchedSchema = stitchSchemas({
  subschemas: [catalogSchema, cartSchema],
});
```

------------------------------------------------------------------------

# 🚀 Express + Apollo Setup

## src/index.ts

``` ts
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

  const server = new ApolloServer({
    schema: stitchedSchema,
  });

  await server.start();

  app.use("/graphql", expressMiddleware(server));

  const port = 4000;
  app.listen(port, () => {
    console.log(`🚀 GraphQL ready at http://localhost:${port}/graphql`);
  });
}

start().catch(console.error);
```

------------------------------------------------------------------------

# ▶️ Run Project

Development mode:

``` bash
npm run dev
```

Production build:

``` bash
npm run build
npm start
```

------------------------------------------------------------------------

# 🧪 Test Queries

## Products

``` graphql
query {
  products {
    id
    title
    price
  }
}
```

## Cart

``` graphql
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

------------------------------------------------------------------------

# ✅ Module 1 Complete

You now understand:

-   Express + Apollo integration
-   package.json script setup
-   Basic GraphQL schema
-   Resolver basics
-   Schema stitching
-   Query-only architecture
