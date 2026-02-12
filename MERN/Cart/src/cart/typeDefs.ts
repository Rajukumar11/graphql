export const cartTypeDefs = `#graphql
type Product {
  id: ID!
  title: String!
  price: Float!
}

 type CartItem {
  productId: ID!
  quantity: Int!
  product: Product
}

  type Cart {
    id: ID!
    items: [CartItem!]!
  }

  input AddToCartInput {
    cartId: ID!
    productId: ID!
    quantity: Int!
  }

  input RemoveFromCartInput {
    cartId: ID!
    productId: ID!
  }

  input ClearCartInput {
    cartId: ID!
  }

  type Query {
    cart(cartId: ID!): Cart!
  }

  type Mutation {
    addToCart(input: AddToCartInput!): Cart!
    removeFromCart(input: RemoveFromCartInput!): Cart!
    clearCart(input: ClearCartInput!): Cart!
  }
`;