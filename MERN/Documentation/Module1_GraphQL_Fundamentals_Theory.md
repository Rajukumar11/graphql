# Module 1 --- GraphQL Fundamentals (Theory Only)

## Schema Language & Resolvers --- Deep Concept Understanding

This module focuses ONLY on theory.

No Express. No Apollo setup. No database. No mutations.

We build a strong foundation of:

-   What is GraphQL
-   Schema Definition Language (SDL)
-   Types
-   Queries
-   Resolvers
-   Execution flow
-   Nullability rules
-   Field resolution model

------------------------------------------------------------------------

# 1️⃣ What is GraphQL?

## WHAT

GraphQL is a **query language + runtime for APIs** that allows clients
to request exactly the data they need.

## WHY

It solves common REST problems: - Over-fetching - Under-fetching -
Multiple round-trips - Weak contracts

## WHEN to Use

-   Complex frontend applications
-   Multiple client platforms
-   Rapid feature iteration
-   Microservices aggregation

------------------------------------------------------------------------

# 2️⃣ Schema Definition Language (SDL)

## WHAT

SDL is the language used to define the structure of your API.

Example:

``` graphql
type Product {
  id: ID!
  title: String!
  price: Float!
}

type Query {
  products: [Product!]!
}
```

## WHY SDL Exists

-   Defines strict API contract
-   Enables validation before execution
-   Enables introspection & documentation
-   Allows tooling & code generation

## KEYWORDS in SDL

type → defines object type\
input → defines input object\
enum → fixed value set\
interface → shared contract\
union → one-of type\
scalar → custom primitive\
Query → read root\
Mutation → write root\
Subscription → real-time root\
! → non-null\
\[\] → list type

------------------------------------------------------------------------

# 3️⃣ Object Types

## WHAT

Structured entities returned by the API.

``` graphql
type Product {
  id: ID!
  title: String!
  price: Float!
}
```

## WHY

-   Strong typing
-   Predictable responses
-   Nested query support

## HOW It Works

GraphQL validates requested fields against this type BEFORE executing
resolvers.

------------------------------------------------------------------------

# 4️⃣ Scalar Types

Built-in:

String\
Int\
Float\
Boolean\
ID

## WHY

Ensure primitive validation.

Example:

``` graphql
price: Float!
```

Prevents returning invalid types.

------------------------------------------------------------------------

# 5️⃣ Non-Null (!) and Lists (\[\])

## Non-Null

``` graphql
title: String!
```

Means field cannot be null.

## List

``` graphql
products: [Product!]!
```

Outer ! → list cannot be null\
Inner ! → items cannot be null

## WHY Nullability Matters

GraphQL enforces precise contracts.\
Frontend reliability depends on correct null modeling.

------------------------------------------------------------------------

# 6️⃣ Query Root Type

## WHAT

Entry point for read operations.

``` graphql
type Query {
  products: [Product!]!
}
```

## WHY Separate Query Root?

GraphQL enforces separation between:

Read → Query\
Write → Mutation\
Realtime → Subscription

This enables:

-   Safe caching
-   Clear architecture
-   Predictable behavior

------------------------------------------------------------------------

# 7️⃣ What Are Resolvers?

## WHAT

Resolvers are functions that return data for schema fields.

Schema defines WHAT is possible.\
Resolvers define HOW data is fetched.

Example:

``` ts
const resolvers = {
  Query: {
    products: () => [
      { id: "p1", title: "T-Shirt", price: 499 }
    ]
  }
};
```

------------------------------------------------------------------------

# 8️⃣ How GraphQL Executes a Query

Example query:

``` graphql
query {
  products {
    id
    title
  }
}
```

Execution Steps:

1️⃣ Validate query against schema\
2️⃣ Call root Query resolver\
3️⃣ For each product, resolve requested fields\
4️⃣ Assemble response

Important:

GraphQL executes **field-by-field**, not endpoint-by-endpoint.

------------------------------------------------------------------------

# 9️⃣ Field-Level Resolution Model

Every field can have its own resolver.

Example:

``` graphql
type CartItem {
  productId: ID!
  quantity: Int!
  product: Product
}
```

If product field has resolver:

``` ts
CartItem: {
  product: (parent) => fetchProduct(parent.productId)
}
```

This is powerful but can cause:

N+1 Problem (solved later with DataLoader)

------------------------------------------------------------------------

# 🔟 Resolver Function Signature

Standard signature:

``` ts
(parent, args, context, info)
```

parent → result from previous resolver\
args → arguments passed in query\
context → shared request object\
info → execution metadata

------------------------------------------------------------------------

# 1️⃣1️⃣ Arguments

Fields can accept parameters:

``` graphql
type Query {
  product(id: ID!): Product
}
```

GraphQL allows arguments at ANY field level.

This enables flexible nested querying.

------------------------------------------------------------------------

# 1️⃣2️⃣ Why GraphQL is Strictly Typed

GraphQL validates before execution.

If client requests:

``` graphql
products {
  unknownField
}
```

Server rejects before touching database.

This is a major architectural advantage over REST.

------------------------------------------------------------------------

# 1️⃣3️⃣ Mental Model Summary

Schema = Blueprint\
Resolvers = Workers\
Query = Request\
Execution Engine = Coordinator

GraphQL first validates structure → then executes logic.

------------------------------------------------------------------------

# 1️⃣4️⃣ Common Beginner Mistakes

❌ Putting business logic inside schema\
❌ Misusing non-null (!) everywhere\
❌ Writing heavy logic in nested resolvers\
❌ Thinking GraphQL replaces database

------------------------------------------------------------------------

# 1️⃣5️⃣ Core Engineering Insight

GraphQL is:

A strongly typed data orchestration layer\
that resolves data field-by-field\
based on a schema contract.

It is NOT: - A database - A framework - A transport protocol

It is a runtime built around type-driven execution.

------------------------------------------------------------------------

# ✅ Module 1 Theory Complete

You now understand:

-   Schema Definition Language (SDL)
-   Types & Scalars
-   Nullability
-   Query root
-   Resolver model
-   Execution flow
-   Field-level resolution behavior

Next module moves into practical implementation.
