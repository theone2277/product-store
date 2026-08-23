import { useCart } from "@/context/useCart";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trash2, ArrowRight, ShieldCheck } from "lucide-react";

type CartProduct = {
  id: number | string;
  image: string;
  title: string;
  price: number;
  category?: string;
};

type CartItem = {
  product: CartProduct;
  quantity: number;
};

type UseCartResult = {
  items: CartItem[];
  updateQuantity: (id: number | string, quantity: number) => void;
  removeFromCart: (id: number | string) => void;
  clearCart: () => void;
  totalPrice: number;
};

function Cart() {
  const { items, updateQuantity, removeFromCart, clearCart, totalPrice } =
    useCart() as UseCartResult;

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-12 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center shadow-sm">
        <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
          🛒
        </div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">
          Your cart is empty
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Looks like you haven't added anything to your cart yet.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
        >
          <span>Start Shopping</span>
          <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          Shopping Cart ({items.length})
        </h1>
        <button
          onClick={clearCart}
          className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
        >
          Clear all
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-3">
          {items.map(({ product, quantity }: CartItem) => (
            <div
              key={product.id}
              className="flex gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs"
            >
              <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-center">
                <img
                  src={product.image}
                  alt={product.title}
                  className="max-h-full object-contain"
                />
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">
                      {product.title}
                    </p>
                    <button
                      onClick={() => removeFromCart(product.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                      aria-label="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {product.category && (
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                      {product.category}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800/80">
                    <button
                      onClick={() => updateQuantity(product.id, quantity - 1)}
                      className="px-2.5 py-0.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-l transition-colors"
                    >
                      -
                    </button>
                    <span className="px-3 py-0.5 font-semibold text-xs text-slate-800 dark:text-slate-100">
                      {quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(product.id, quantity + 1)}
                      className="px-2.5 py-0.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-r transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    ${(product.price * quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs sticky top-24">
          <h2 className="font-bold text-slate-900 dark:text-white text-base mb-4">Order Summary</h2>

          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal</span>
              <span className="font-medium text-slate-900 dark:text-white">
                ${totalPrice.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Shipping</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">Free</span>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between font-bold text-base text-slate-900 dark:text-white">
              <span>Total</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
          </div>

          <Button className="w-full mt-5 gap-2">
            <span>Checkout</span>
            <ArrowRight size={16} />
          </Button>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Secure checkout guaranteed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Cart;
