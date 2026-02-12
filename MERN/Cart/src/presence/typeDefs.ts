export const presenceTypeDefs = `#graphql
  type PresenceEvent {
    userId: ID!
    status: String! # ONLINE | OFFLINE
    lastSeenAt: String!
  }

  type Query {
    # simple query for debugging
    onlineUsers: [ID!]!
  }

  type Subscription {
    presenceUpdates: PresenceEvent!
  }
`;