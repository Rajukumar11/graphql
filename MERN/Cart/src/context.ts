import DataLoader from "dataloader";
import type { Db } from "mongodb";
import { getDb } from "./db/mongo";
import { SimplePubSub } from "./pubsub";
import jwt from "jsonwebtoken";
export type GraphQLContext = {
  db: Db;
  loaders: {
    productLoader: DataLoader<string, any>;
  };
  pubsub: SimplePubSub;
  // ✅ NEW (Auth)
  user: AuthUser | null;
  userId?: string;
};

export type AuthUser = {
  id: string;
  role: "USER" | "ADMIN";
};
const pubsubSingleton = new SimplePubSub();

function parseAuthHeader(authorization?: string): AuthUser | null {
  if (!authorization) return null;

  const token = authorization.replace("Bearer ", "").trim();
  if (!token) return null;

  try {
    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(token, secret) as any;
    return { id: decoded.id, role: decoded.role };
  } catch {
    return null;
  }
}

export async function buildContext(input?: { authorization?: string }): Promise<GraphQLContext> {
  const db = await getDb();
 const user = parseAuthHeader(input?.authorization);
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
    user,
    pubsub: pubsubSingleton,
  };
}

export function getPubSub() {
  return pubsubSingleton;
}