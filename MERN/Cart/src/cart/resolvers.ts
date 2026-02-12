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