const products = [
  { id: "p1", title: "T-Shirt", price: 499.0 },
  { id: "p2", title: "Shoes", price: 1999.0 },
];

export const catalogResolvers = {
  Query: {
    products: () => products,
  },
};