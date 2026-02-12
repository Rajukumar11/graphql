import { products } from "./store";

export const catalogResolvers = {
  Query: {
    products: () => products,
  },
};