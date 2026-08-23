import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchProductById } from "@/api/product";
import { useCart } from "@/context/useCart";
import { Button } from "@/components/ui/button";
import type { Product } from "@/types/product";
import { ArrowLeft } from "lucide-react";

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToCart } = useCart();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchProductById(id!);
        if (!cancelled) {
          setProduct(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load product");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-3">
        <div className="w-10 h-10 border-4 border-blue-200 dark:border-slate-800 border-t-blue-600 dark:border-t-blue-500 rounded-full animate-spin" />
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium animate-pulse">
          Loading product details...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-6">
          <p className="text-red-600 dark:text-red-400 text-base font-semibold mb-1">
            Failed to load product
          </p>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Back to Products</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-20 text-slate-500 dark:text-slate-400 text-base">
        Product not found
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      {/* Back Link */}
      <Link
        to="/"
        className="group text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium mb-6 inline-flex items-center gap-2 transition-colors text-sm"
      >
        <ArrowLeft
          size={18}
          className="group-hover:-translate-x-1 transition-transform duration-200"
        />
        <span>Back to Products</span>
      </Link>

      {/* Main Product Card */}
      <div className="grid md:grid-cols-2 gap-6 sm:gap-8 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Product Image Stage */}
        <div className="flex justify-center items-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg min-h-[320px] border border-slate-100 dark:border-slate-800">
          <img src={product.image} alt={product.title} className="max-h-80 object-contain" />
        </div>

        {/* Product Details & Actions */}
        <div className="flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
              {product.category}
            </span>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mt-2 leading-tight">
              {product.title}
            </h1>

            {/* Rating */}
            {product.rating && (
              <div className="flex items-center mt-3 gap-1.5 text-sm">
                <span className="text-amber-500 font-bold">&#9733;</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {product.rating.rate}
                </span>
                <span className="text-slate-400 dark:text-slate-500 text-xs">
                  ({product.rating.count} reviews)
                </span>
              </div>
            )}

            {/* Price */}
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-4">
              ${product.price.toFixed(2)}
            </p>

            <div className="border-t border-slate-200 dark:border-slate-800 my-5" />

            {/* Description */}
            <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-xs tracking-wider uppercase">
              Description
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Add to Cart CTA */}
          <div className="mt-8">
            <Button className="w-full md:w-auto px-8" onClick={() => addToCart(product)}>
              Add to Cart
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
