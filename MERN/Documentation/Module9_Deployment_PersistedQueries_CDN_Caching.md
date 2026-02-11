# Module 9 (Practical) --- Deployment: Persisted Queries + CDN + Caching (Ecommerce Cart)

This module prepares your GraphQL server for **production deployment**.

✅ Module 9 focus: - Persisted Queries (APQ -- Automatic Persisted
Queries) - CDN caching strategy - HTTP caching with proper headers -
Cache control hints in Apollo Server

We will make the API: - Faster - More secure - CDN-friendly -
Production-ready

------------------------------------------------------------------------

# 1) WHAT we add

### A) Persisted Queries

Client sends query hash instead of full query string.

Benefits: - Smaller request payload - Protection against malicious
arbitrary queries - Better CDN cache hit ratio

### B) HTTP Cache Control

Enable caching for safe queries (like products list).

### C) CDN Layer

Deploy behind: - Cloudflare - Fastly - AWS CloudFront

------------------------------------------------------------------------

# 2) WHY this matters

Without persisted queries: - Large payloads - Hard to cache at CDN -
Query injection risk

Without cache control: - CDN cannot cache safely - Every request hits
origin server

------------------------------------------------------------------------

# A) Enable Automatic Persisted Queries (APQ)

Apollo Server v5 supports APQ via plugin.

Update `src/index.ts` when creating ApolloServer:

``` ts
import { ApolloServerPluginUsageReportingDisabled } from "@apollo/server/plugin/disabled";

const apollo = new ApolloServer({
  schema: stitchedSchema,

  plugins: [
    ApolloServerPluginUsageReportingDisabled(),

    // Enable Automatic Persisted Queries
    {
      async requestDidStart() {
        return {};
      }
    }
  ],

  persistedQueries: {
    ttl: 900, // 15 minutes in-memory cache
  },
});
```

Note: APQ works automatically with Apollo Client when enabled.

------------------------------------------------------------------------

# B) Install Apollo Client (for frontend APQ test)

``` bash
npm install @apollo/client graphql
```

Client example:

``` ts
import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";
import { createPersistedQueryLink } from "@apollo/client/link/persisted-queries";

const client = new ApolloClient({
  link: createPersistedQueryLink().concat(
    new HttpLink({ uri: "http://localhost:4000/graphql" })
  ),
  cache: new InMemoryCache(),
});
```

------------------------------------------------------------------------

# C) Add Cache Control to Schema

Install cache control plugin:

``` bash
npm install @apollo/server-plugin-cache-control
```

Update ApolloServer:

``` ts
import { ApolloServerPluginCacheControl } from "@apollo/server/plugin/cacheControl";

const apollo = new ApolloServer({
  schema: stitchedSchema,

  plugins: [
    ApolloServerPluginCacheControl({
      defaultMaxAge: 0,
      calculateHttpHeaders: true,
    }),
  ],
});
```

------------------------------------------------------------------------

# D) Add Cache Hints in Resolvers

Example: cache products for 60 seconds.

Update `src/catalog/resolvers.ts`:

``` ts
productsConnection: async (_, args, ctx, info) => {
  info.cacheControl.setCacheHint({
    maxAge: 60,
    scope: "PUBLIC",
  });

  // existing logic...
}
```

Now response will include:

    Cache-Control: public, max-age=60

CDN can cache it.

------------------------------------------------------------------------

# E) Add Response Cache (Optional)

Apollo does not cache responses by default.

Install:

``` bash
npm install @apollo/server-plugin-response-cache
```

Then:

``` ts
import { ApolloServerPluginResponseCache } from "@apollo/server/plugin/responseCache";

plugins: [
  ApolloServerPluginResponseCache(),
]
```

------------------------------------------------------------------------

# F) CDN Strategy

## 1) Safe to Cache

-   productsConnection
-   product details
-   public content

## 2) Do NOT Cache

-   me
-   cart
-   adminStats
-   authenticated queries

Use:

    scope: PRIVATE

for user-specific responses.

------------------------------------------------------------------------

# G) Production Build

## 1) Build project

``` bash
npm run build
```

## 2) Run production server

``` bash
NODE_ENV=production node dist/index.js
```

## 3) Use PM2 (optional)

``` bash
npm install -g pm2
pm2 start dist/index.js --name graphql-api
```

------------------------------------------------------------------------

# H) Dockerfile Example

Create `Dockerfile`:

``` dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY dist ./dist

ENV NODE_ENV=production

EXPOSE 4000

CMD ["node", "dist/index.js"]
```

Build & run:

``` bash
docker build -t graphql-cart .
docker run -p 4000:4000 graphql-cart
```

------------------------------------------------------------------------

# I) Production Checklist

-   [ ] NODE_ENV=production
-   [ ] Error masking enabled (Module 8)
-   [ ] JWT secret secured
-   [ ] Mongo secured (auth enabled)
-   [ ] CDN configured
-   [ ] APQ enabled
-   [ ] Rate limiting added (optional future module)

------------------------------------------------------------------------

# Common Mistakes (Fast Fix)

### ❌ CDN caching authenticated responses

Ensure PRIVATE scope for user-specific data.

### ❌ Persisted queries not working

Apollo Client must use persisted query link.

### ❌ No cache headers in response

Ensure `calculateHttpHeaders: true` in CacheControl plugin.

------------------------------------------------------------------------

# Module 9 Complete ✅

You now have: - Automatic Persisted Queries (APQ) - HTTP cache headers -
Cache hints in resolvers - CDN-friendly GraphQL - Docker-ready
deployment

Final module preview: - Observability - Metrics - Health checks -
Production monitoring
