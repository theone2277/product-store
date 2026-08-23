import { createContext } from "react";
import type { Product } from "@/types/product";

export interface ProductContextValue {
  products: Product[];
  categories: string[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  sortOrder: "none" | "price-asc" | "price-desc";
  setSortOrder: (order: "none" | "price-asc" | "price-desc") => void;
  filteredProduct: Product[];
}

export const ProductContext = createContext<ProductContextValue | undefined>(
  undefined,
);
