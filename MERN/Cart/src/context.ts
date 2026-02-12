import DataLoader from "dataloader";
import { getProductsByIds } from "./catalog/store";
import { SimplePubSub } from "./pubsub";

export type GraphQLContext = {
  loaders: {
    productLoader: DataLoader<string, any>;
  };
  pubsub: SimplePubSub;
};

// IMPORTANT: PubSub should be shared for the whole server process
// so all requests + WS connections publish to the same event bus.
const pubsubSingleton = new SimplePubSub();

export function buildContext(): GraphQLContext {
  const productLoader = new DataLoader<string, any>(async (ids) => {
    return getProductsByIds(ids);
  });

  return {
    loaders: { productLoader },
    pubsub: pubsubSingleton,
  };
}

export function getPubSub() {
  return pubsubSingleton;
}