import type { Product } from "@/types/product";

const BASE_URL = "https://fakestoreapi.com";

export async function fetchProduct() {
  const res = await fetch(`${BASE_URL}/products`);
  if (!res.ok) {
    throw new Error("Failed to fetch products: " + res.status);
  }
  return res.json();
}
export async function fetchCategories(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/products/categories`);
  if (!res.ok) {
    throw new Error("Failed to fetch categories: " + res.status);
  }
  return res.json();
}
export async function fetchProductById(id: string): Promise<Product> {
  const res = await fetch(`${BASE_URL}/products/${id}`);
  if (!res.ok) {
    throw new Error("Failed to fetch product: " + res.status);
  }
  return res.json();
}
