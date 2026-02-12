import { getDb } from "./mongo";

type ProductDoc = {
  _id: string;     // string id: "p1"
  title: string;
  price: number;
};

async function seed() {
  const db = await getDb();
  const products = db.collection<ProductDoc>("products");

  const existing = await products.countDocuments();
  if (existing > 0) {
    console.log("ℹ️ Products already exist, skipping seed.");
    process.exit(0);
  }

  await products.insertMany([
    { _id: "p1", title: "T-Shirt", price: 499.0 },
    { _id: "p2", title: "Shoes", price: 1999.0 },
    { _id: "p3", title: "Cap", price: 299.0 },
  ]);

  console.log("✅ Seeded products into MongoDB.");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});