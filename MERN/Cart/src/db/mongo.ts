import { MongoClient, Db } from "mongodb";
import dotenv from 'dotenv'
dotenv.config();
const MONGO_URI = process.env.MONGO_URI || "testing";
const DB_NAME = process.env.DB_NAME || "hello";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;
  console.log(MONGO_URI)
  console.log(DB_NAME)
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);

  console.log("✅ Connected to MongoDB:", DB_NAME);
  return db;
}