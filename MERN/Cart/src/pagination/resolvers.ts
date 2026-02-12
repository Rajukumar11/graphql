import type { GraphQLContext } from "../context";

function encodeCursor(id: string) {
  return Buffer.from(id, "utf8").toString("base64");
}

function decodeCursor(cursor: string) {
  return Buffer.from(cursor, "base64").toString("utf8");
}

const MAX_PAGE = 50;

export const paginationResolvers = {
  Query: {
    // -----------------------------
    // Part 1: Cursor pagination (forward)
    // -----------------------------
    productsCursor: async (
      _: unknown,
      args: { first: number; after?: string },
      ctx: GraphQLContext
    ) => {
      const first = Math.min(Math.max(args.first, 1), MAX_PAGE);
      const filter: any = {};

      if (args.after) {
        filter._id = { $gt: decodeCursor(args.after) };
      }

      const rows = await ctx.db
        .collection("products")
        .find(filter)
        .sort({ _id: 1 })
        .limit(first + 1)
        .toArray();

      const hasNextPage = rows.length > first;
      const sliced = rows.slice(0, first);

      const nextCursor = sliced.length > 0 ? encodeCursor(String(sliced[sliced.length - 1]._id)) : null;

      // NOTE: Map to your Product shape (id/title/price)
      const items = sliced.map((p: any) => ({
        id: String(p._id),
        title: p.title,
        price: p.price,
      }));

      return {
        items,
        nextCursor,
        hasNextPage,
      };
    },

    // -----------------------------
    // Part 2: Relay connection
    // -----------------------------
    productsConnection: async (
      _: unknown,
      args: { first?: number; after?: string; last?: number; before?: string },
      ctx: GraphQLContext
    ) => {
      const first = args.first ?? undefined;
      const last = args.last ?? undefined;

      // Relay rule: provide exactly one of first/last
      if ((first && last) || (!first && !last)) {
        throw new Error("Provide exactly one of `first` or `last`.");
      }

      const limitRequested = first ?? last ?? 10;
      const limit = Math.min(Math.max(limitRequested, 1), MAX_PAGE);

      const filter: any = {};

      // Forward
      if (first) {
        if (args.after) {
          filter._id = { $gt: decodeCursor(args.after) };
        }

        const rows = await ctx.db
          .collection("products")
          .find(filter)
          .sort({ _id: 1 })
          .limit(limit + 1)
          .toArray();

        const hasNextPage = rows.length > limit;
        const sliced = rows.slice(0, limit);

        const edges = sliced.map((p: any) => ({
          cursor: encodeCursor(String(p._id)),
          node: { id: String(p._id), title: p.title, price: p.price },
        }));

        return {
          edges,
          pageInfo: {
            hasNextPage,
            hasPreviousPage: !!args.after,
            startCursor: edges[0]?.cursor ?? null,
            endCursor: edges.length ? edges[edges.length - 1].cursor : null,
          },
          totalCount: await ctx.db.collection("products").countDocuments({}),
        };
      }

      // Backward
      if (last) {
        if (args.before) {
          filter._id = { $lt: decodeCursor(args.before) };
        }

        const rows = await ctx.db
          .collection("products")
          .find(filter)
          .sort({ _id: -1 })
          .limit(limit + 1)
          .toArray();

        const hasPreviousPage = rows.length > limit;
        const slicedDesc = rows.slice(0, limit);
        const sliced = slicedDesc.reverse(); // return ascending

        const edges = sliced.map((p: any) => ({
          cursor: encodeCursor(String(p._id)),
          node: { id: String(p._id), title: p.title, price: p.price },
        }));

        return {
          edges,
          pageInfo: {
            hasNextPage: !!args.before,
            hasPreviousPage,
            startCursor: edges[0]?.cursor ?? null,
            endCursor: edges.length ? edges[edges.length - 1].cursor : null,
          },
          totalCount: await ctx.db.collection("products").countDocuments({}),
        };
      }
    },
  },
};