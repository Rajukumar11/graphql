import {ApolloServer} from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import express, { Request } from 'express';
import cors from "cors";
import bodyParser from "body-parser";



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

async function start(){
    const server = new ApolloServer({typeDefs,resolvers});
    const app = express();
    app.use(cors())
    app.use(bodyParser.json())
    await server.start();
    app.use("/graphql",
        (expressMiddleware(server)));
          
   
    app.get("/health",(_req,res)=>{
        res.json({"result":"Ok"})
    })

    const PORT = 4000
    app.listen(PORT,()=>{
        console.log("Server is running on Port 4000 and /graphql")
        console.log("Server is running on Port 4000 and /health")
    })
    

 


}
start().catch(err=>{
    console.error(`Something Went Wrong ${err}`);
    process.exit(1);
});