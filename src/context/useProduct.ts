import { useContext } from "react";
import { ProductContext } from "./ProductContext";

export function useProduct() {
  const ctx = useContext(ProductContext);

  if (!ctx) {
    throw new Error("useProduct must be used within the ProductProvider");
  }

  return ctx;
}
