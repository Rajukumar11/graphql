"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("@apollo/server");
const standalone_1 = require("@apollo/server/standalone");
const typeDefs = `#graphql
type Query {
    health:String!
    hello(name:String!):String!
}
`;
const resolvers = {
    Query: {
        health: () => "OK",
        hello: (_, name) => `Hello Friends ${name}`
    }
};
async function bootStrap() {
    const server = new server_1.ApolloServer({ typeDefs, resolvers });
    const { url } = await (0, standalone_1.startStandaloneServer)(server, { listen: { port: 4000 } });
    console.log(`Server is listing at ${url}`);
}
bootStrap().catch(err => {
    console.error(`Something Went Wrong ${err}`);
    process.exit(1);
});
