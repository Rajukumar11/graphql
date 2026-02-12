export const products = [
  { id: "p1", title: "T-Shirt", price: 499.0 },
  { id: "p2", title: "Shoes", price: 1999.0 },
  { id: "p3", title: "Cap", price: 299.0 },
];

// Naive single fetch (simulates 1 DB call per product)
export function getProductById(id: string) {
  console.log("❌ DB HIT (single):", id);
  return products.find((p) => p.id === id) ?? null;
}

// Batch fetch (simulates 1 DB call for many products)
export function getProductsByIds(ids: readonly string[]) {
  console.log("📦 DB HIT (batch):", ids);
  const map = new Map(products.map((p) => [p.id, p]));
  return ids.map((id) => map.get(id) ?? null);
}