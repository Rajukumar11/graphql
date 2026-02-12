export const userTypeDefs = `#graphql
  directive @auth(role: String) on FIELD_DEFINITION

  type User {
    id: ID!
    name: String!
    email: String!
    role: String!
  }

  type Query {
    me: User @auth
    adminStats: String! @auth(role: "ADMIN")
  }

  type Mutation {
    login(userId: ID!, role: String!): String!
  }
`;