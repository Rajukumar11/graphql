export const cartTypeDefs = `#graphql
  type CartItem {
    productId: ID!
    quantity: Int!
  }

  type Cart {
    id: ID!
    items: [CartItem!]!
    price: String!
    Quantity: Int!
    publicationDate: String
    author: String
    edition: String
    publisher: String
  }

  type Query {
    cart(cartId: ID!): Cart!
    cartbyprice(cartId: ID!,price: String!): Cart!
    cartbyauthor(cartId: ID!,author: String!): Cart!
  }
   
`;