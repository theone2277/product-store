import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import type { Product } from "@/types/product";
import { useCart } from "@/context/useCart";
import { Plus } from "lucide-react";

interface ProductCardProps {
  product: Product;
}

function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();

  return (
    <div className="group relative bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200">
      <Link to={`/product/${product.id}`} className="flex-1 flex flex-col">
        <div className="relative h-44 flex items-center justify-center bg-slate-50/70 dark:bg-slate-800/40 rounded-xl p-4 overflow-hidden mb-3">
          <span className="absolute top-2.5 left-2.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs border border-slate-200/60 dark:border-slate-700 px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            {product.category}
          </span>
          <img
            src={product.image}
            alt={product.title}
            className="max-h-36 object-contain group-hover:scale-105 transition-transform duration-200"
          />
        </div>

        <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {product.title}
        </h3>
      </Link>

      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-slate-400 block font-medium">Price</span>
          <p className="font-extrabold text-base text-slate-900 dark:text-white">
            ${product.price.toFixed(2)}
          </p>
        </div>

        <Button size="sm" onClick={() => addToCart(product)} className="rounded-lg gap-1 px-3">
          <Plus size={14} />
          <span>Add</span>
        </Button>
      </div>
    </div>
  );
}

export default ProductCard;
