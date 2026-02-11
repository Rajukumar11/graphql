
# Module 2 (Practical) — Ecommerce Cart: Mutations + Input Types (Simple)

This module continues the **same project** from Module 1 (Express + Schema stitching).

✅ Module 2 focus:
- Add **Mutation** operations for Cart
- Use **Input Types** (best practice for clean APIs)
- Keep everything **simple + in-memory**
- No auth, no DB, no DataLoader yet

---

## What / Why / When (Quick)

### WHAT are we adding?
We add write operations:
- `addToCart(input: AddToCartInput!): Cart!`
- `removeFromCart(input: RemoveFromCartInput!): Cart!`
- `clearCart(cartId: ID!): Cart!`

### WHY use input types?
- Cleaner schema (one argument instead of many)
- Easier to extend later (add fields without breaking clients)
- Better validation structure

### WHEN should you use input types?
Almost always for mutations in production.

---

# A) Update Cart Schema (Input Types + Mutations)

## 1) Update `src/cart/typeDefs.ts`
Replace your file with:

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

✅ What changed:
- Added `input AddToCartInput`
- Added `input RemoveFromCartInput`
- Added `type Mutation`

---

# B) Update Cart Resolvers (Implement Mutations)

## 1) Update `src/cart/resolvers.ts`
Replace your file with:

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

// Module 2: pre-seed one cart for testing
getOrCreateCart("c1").items.push({ productId: "p1", quantity: 2 });

export const cartResolvers = {
  Query: {
    cart: (_: unknown, args: { cartId: string }) => getOrCreateCart(args.cartId),
  },

  Mutation: {
    addToCart: (
      _: unknown,
      args: { input: { cartId: string; productId: string; quantity: number } }
    ) => {
      const { cartId, productId } = args.input;

      // Basic input guard: quantity must be >= 1
      const quantity = Math.max(1, args.input.quantity);

      const cart = getOrCreateCart(cartId);
      const item = cart.items.find((i) => i.productId === productId);

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

      cart.items = cart.items.filter((i) => i.productId !== productId);
      return cart;
    },

    clearCart: (_: unknown, args: { cartId: string }) => {
      const cart = getOrCreateCart(args.cartId);
      cart.items = [];
      return cart;
    },
  },
};
```

✅ What changed:
- Added `Mutation` object
- Implemented 3 mutations
- Used input objects for add/remove

---

# C) Stitching (No Change)

✅ You do NOT change stitching.
Your `stitchedSchema` automatically merges the new `Mutation` type from Cart schema.

---

# D) Run Module 2

```bash
npm run dev
```

Open:
- `http://localhost:4000/graphql`

---

# E) Test Queries & Mutations (Copy-Paste)

## 1) Query products (Catalog)
```graphql
query {
  products {
    id
    title
    price
  }
}
```

## 2) Query cart
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

## 3) Add to cart (Mutation + Input Type)
```graphql
mutation {
  addToCart(input: { cartId: "c1", productId: "p2", quantity: 1 }) {
    id
    items {
      productId
      quantity
    }
  }
}
```

## 4) Remove from cart
```graphql
mutation {
  removeFromCart(input: { cartId: "c1", productId: "p1" }) {
    id
    items {
      productId
      quantity
    }
  }
}
```

## 5) Clear cart
```graphql
mutation {
  clearCart(cartId: "c1") {
    id
    items {
      productId
      quantity
    }
  }
}
```

---

# Common Mistakes (Fast Fix)

### ❌ “Cannot query field Mutation”
This means your schema still doesn’t include Mutation.
- Ensure you updated `cart/typeDefs.ts`
- Restart dev server (`Ctrl+C` then `npm run dev`)

### ❌ Passing wrong input shape
Correct:
```graphql
addToCart(input: { cartId: "c1", productId: "p2", quantity: 1 })
```

Wrong:
```graphql
addToCart(cartId: "c1", productId: "p2", quantity: 1)
```

---

# Module 2 Complete ✅

You now have:
- Express + Apollo running
- Stitched schema (Catalog + Cart)
- Mutations added safely
- Input types introduced

Next module preview:
- Add `CartItem.product: Product!` (link Cart → Catalog)
- Then fix N+1 using DataLoader
