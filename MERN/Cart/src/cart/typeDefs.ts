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

  type CartSummary {
    cartId: ID!
    totalItems: Int!
    totalPrice: Float!
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
    cartSummary(cartId: ID!): CartSummary!
  }

  type Mutation {
    addToCart(input: AddToCartInput!): Cart!
    removeFromCart(input: RemoveFromCartInput!): Cart!
    clearCart(input: ClearCartInput!): Cart!
  }
`;