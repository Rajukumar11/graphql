import {ApolloServer} from "@apollo/server";
import {startStandaloneServer} from '@apollo/server/standalone';


const typeDefs = `#graphql
type Query {
    health:String!
    hello(name:String!):String!
}
`
const resolvers = {
    Query:{
        health : ()=>"OK",
        hello:(_:unknown,args:{name?:string})=> {
            return `Hello ${args.name ?? "World"}`
        }
    }
}

async function bootStrap(){
    const server = new ApolloServer({typeDefs,resolvers});

    const {url} = await startStandaloneServer(server,{listen:{port:4000}})

    console.log(`Server is listing at ${url}`)


}
bootStrap().catch(err=>{
    console.error(`Something Went Wrong ${err}`);
    process.exit(1);
});