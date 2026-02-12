import DataLoader from "dataloader";
import type { Db } from "mongodb";
import { getDb } from "./db/mongo";
import { SimplePubSub } from "./pubsub";

export type GraphQLContext = {
  db: Db;
  loaders: {
    productLoader: DataLoader<string, any>;
  };
  pubsub: SimplePubSub;
  userId?: string;
};

const pubsubSingleton = new SimplePubSub();

export async function buildContext(): Promise<GraphQLContext> {
  const db = await getDb();

  const productLoader = new DataLoader<string, any>(async (ids) => {
    const rows = await db
      .collection("products")
      .find({ _id: { $in: ids as any } })
      .toArray();

    const map = new Map(rows.map((r: any) => [r._id, r]));
    return ids.map((id) => map.get(id) ?? null);
  });

  return {
    db,
    loaders: { productLoader },
    pubsub: pubsubSingleton,
  };
}

export function getPubSub() {
  return pubsubSingleton;
}