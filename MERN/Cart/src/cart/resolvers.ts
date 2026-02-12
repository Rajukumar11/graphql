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