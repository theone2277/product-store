import FilterBar from "@/components/FilterBar";
import ProductCard from "@/components/ProductCard";
import { useProduct } from "@/context/useProduct";
import { Sparkles } from "lucide-react";

function Home() {
  const { loading, error, filteredProduct } = useProduct();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-3">
        <div className="w-10 h-10 border-4 border-blue-200 dark:border-slate-800 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium animate-pulse">
          Loading catalog...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-6">
          <p className="text-red-600 dark:text-red-400 text-base font-semibold mb-1">
            Failed to load catalog
          </p>
          <p className="text-slate-600 dark:text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-2.5">
          <Sparkles size={13} />
          <span>Curated Collection</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Explore Products
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Browse through our curated items with real-time stock and fast delivery.
        </p>
      </div>

      <FilterBar />

      {filteredProduct.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-slate-800 dark:text-slate-200 text-base font-semibold">
            No products found
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Try adjusting your search keywords or resetting your filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {filteredProduct.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </main>
  );
}

export default Home;
