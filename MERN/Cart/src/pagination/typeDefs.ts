export const paginationTypeDefs = `#graphql
  scalar Cursor
type Product {
    id: ID!
    title: String!
    price: Float!
  }
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: Cursor
    endCursor: Cursor
  }

  # Non-relay (cursor pagination)
  type ProductsCursorPage {
    items: [Product!]!
    nextCursor: Cursor
    hasNextPage: Boolean!
  }

  # Relay connection types
  type ProductEdge {
    cursor: Cursor!
    node: Product!
  }

  type ProductConnection {
    edges: [ProductEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type Query {
    # Part 1: Cursor pagination (forward only)
    productsCursor(first: Int!, after: Cursor): ProductsCursorPage!

    # Part 2: Relay pagination (forward/backward)
    productsConnection(
      first: Int
      after: Cursor
      last: Int
      before: Cursor
    ): ProductConnection!
  }
`;