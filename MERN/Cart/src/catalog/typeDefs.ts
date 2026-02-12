export const catalogTypeDefs = `#graphql
  type Product {
    id: ID!
    title: String!
    price: Float!
  }

  type Query {
    products: [Product!]!
  }
`;