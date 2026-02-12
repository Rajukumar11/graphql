import DataLoader from "dataloader";
import { getProductsByIds } from "./catalog/store";

export type GraphQLContext = {
  loaders: {
    productLoader: DataLoader<string, any>;
  };
};

export function buildContext(): GraphQLContext {
  return {
    loaders: {
      productLoader: new DataLoader(async (ids) => {
        return getProductsByIds(ids);
      }),
    },
  };
}