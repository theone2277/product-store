import { Link } from "react-router-dom";
import type { Product } from "@/types/product";
import { useCart } from "@/context/useCart";

interface ProductCardProps {
  product: Product;
}

function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-white dark:bg-gray-900 flex flex-col justify-between">
      <Link to={`/product/${product.id}`} className="block">
        <div className="h-44 flex items-center justify-center p-2 mb-3">
          <img src={product.image} alt={product.title} className="max-h-full object-contain" />
        </div>

        <p className="text-xs text-gray-400 capitalize mb-1">{product.category}</p>
        <h3 className="font-medium text-sm text-gray-900 dark:text-white line-clamp-2 hover:underline">
          {product.title}
        </h3>
      </Link>

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <span className="font-semibold text-gray-900 dark:text-white text-base">
          ${product.price.toFixed(2)}
        </span>
        <button
          onClick={() => addToCart(product)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}

export default ProductCard;
