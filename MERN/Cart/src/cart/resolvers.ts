type CartItem = { productId: string; quantity: number };
import { getProductById } from "../catalog/store";


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
  CartItem: {
  product: (parent: { productId: string }) => {
    return getProductById(parent.productId);
  }
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