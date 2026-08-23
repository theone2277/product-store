import { useContext } from "react";
import { CartContext } from "./CardContext";

export function useCart() {
  const ctx = useContext(CartContext);

  if (!ctx) {
    throw new Error("useCart must be used within the CartProvider");
  }

  return ctx;
}
