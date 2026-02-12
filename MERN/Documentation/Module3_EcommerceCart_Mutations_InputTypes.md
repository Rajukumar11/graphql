# Module 2 (Practical) --- Mutations + Input Types

## Ecommerce Cart (Incremental Project)

This module builds on Module 1 (Express + Schema Stitching).

Focus: - Add Mutations - Use Input Types - Keep implementation simple
(in-memory) - No DB, No Auth yet

------------------------------------------------------------------------

# 1️⃣ WHAT We Add

New Mutations:

-   addToCart(input: AddToCartInput!): Cart!
-   removeFromCart(input: RemoveFromCartInput!): Cart!
-   clearCart(input: ClearCartInput!): Cart!

------------------------------------------------------------------------

# 2️⃣ WHY Use Input Types?

Instead of:

addToCart(cartId: ID!, productId: ID!, quantity: Int!)

We use:

addToCart(input: AddToCartInput!)

Benefits: - Cleaner schema - Easier to extend later - Standard
production practice

------------------------------------------------------------------------

# 3️⃣ Update src/cart/typeDefs.ts

Replace entire file with:

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

  type Query {
    cart(cartId: ID!): Cart!
  }

  type Mutation {
    addToCart(input: AddToCartInput!): Cart!
    removeFromCart(input: RemoveFromCartInput!): Cart!
    clearCart(input: ClearCartInput!): Cart!
  }
`;
```

------------------------------------------------------------------------

# 4️⃣ Update src/cart/resolvers.ts

Replace entire file with:

``` ts
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
    cart: (_: unknown, args: { cartId: string }) =>
      getOrCreateCart(args.cartId),
  },

  Mutation: {
    addToCart: (
      _: unknown,
      args: { input: { cartId: string; productId: string; quantity: number } }
    ) => {
      const { cartId, productId } = args.input;
      const quantity = Math.max(1, args.input.quantity);

      const cart = getOrCreateCart(cartId);
      const item = cart.items.find(i => i.productId === productId);

      if (item) item.quantity += quantity;
      else cart.items.push({ productId, quantity });

      return cart;
    },

    removeFromCart: (
      _: unknown,
      args: { input: { cartId: string; productId: string } }
    ) => {
      const { cartId, productId } = args.input;
      const cart = getOrCreateCart(cartId);

      cart.items = cart.items.filter(i => i.productId !== productId);
      return cart;
    },

    clearCart: (
      _: unknown,
      args: { input: { cartId: string } }
    ) => {
      const { cartId } = args.input;
      const cart = getOrCreateCart(cartId);

      cart.items = [];
      return cart;
    },
  },
};
```

------------------------------------------------------------------------

# 5️⃣ Stitching Reminder

Ensure src/stitching/stitchedSchema.ts includes:

``` ts
export const stitchedSchema = stitchSchemas({
  subschemas: [catalogSchema, cartSchema],
});
```

------------------------------------------------------------------------

# 6️⃣ Run Project

``` bash
npm run dev
```

------------------------------------------------------------------------

# 7️⃣ Test Mutations

Add item:

``` graphql
mutation {
  addToCart(input: { cartId: "c1", productId: "p1", quantity: 2 }) {
    id
    items { productId quantity }
  }
}
```

Remove item:

``` graphql
mutation {
  removeFromCart(input: { cartId: "c1", productId: "p1" }) {
    id
    items { productId quantity }
  }
}
```

Clear cart:

``` graphql
mutation {
  clearCart(input: { cartId: "c1" }) {
    id
    items { productId quantity }
  }
}
```

------------------------------------------------------------------------

# ✅ Module 2 Complete

You now understand:

-   Mutation root type
-   Input types
-   Clean argument modeling
-   In-memory cart logic
-   Proper GraphQL mutation execution
