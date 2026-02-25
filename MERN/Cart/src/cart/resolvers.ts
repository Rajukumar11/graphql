type CartItem = { productId: string; quantity: number };
type Cart = { id: string; items: CartItem[], price: string, Quantity: number,publicationDate: string,
    author: string, edition: string, publisher: string };

const carts = new Map<string, Cart>();


carts.set("c1", {
  id: "c1",
  items: [{ productId: "p1", quantity: 2}],
  price: "10",
  Quantity: 1,
  publicationDate: "02/18/2026",
  author: "Hrithik",
  edition: "E11",
  publisher: "Null 1"
  
});

carts.set("c2", {
  id: "c2",
  items: [{ productId: "p2", quantity: 2 }],
  price: "20",
  Quantity: 2,
  publicationDate: "02/12/2026",
  author: "Roshan",
  edition: "E12",
  publisher: "Null 2"
     
});

carts.set("c3", {
  id: "c3",
  items: [{ productId: "p3", quantity: 2 }],
  price: "30",
  Quantity: 3,
  publicationDate: "02/11/2026",
  author: "Bollywood",
  edition: "E12",
  publisher: "Null 2"
});

export const cartResolvers = {
  Query: {
    cart: (_: unknown, args: { cartId: string }) => {
      return carts.get(args.cartId) ?? { id: args.cartId, items: [] };
    },
      cartbyprice: (_: unknown, args: { cartId: string, price: string}) => {
      let cart = carts.get(args.cartId);
      let result = cart && cart.price== args.price ? cart : { id: args.cartId, items: [] };
      return result; 
    },
    // cartbyauthor: (_: unknown, args: { cartId: string, author: string}) => {
    //   let cart = carts.get(args.cartId);
    //   let result = cart && cart.author== args.author ? cart : { id: args.cartId, items: [] };
    //   return result; 

    // },
  },
}