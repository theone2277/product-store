import FilterBar from "@/components/FilterBar";
import ProductCard from "@/components/ProductCard";
import { useProduct } from "@/context/useProduct";

function Home() {
  const { loading, error, filteredProduct } = useProduct();

  if (loading) {
    return <div className="py-20 text-center text-sm text-gray-500">Loading items...</div>;
  }

  if (error) {
    return <div className="py-20 text-center text-sm text-red-500">{error}</div>;
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <FilterBar />

      {filteredProduct.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-500 border border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
          No products found.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProduct.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </main>
  );
}

export default Home;
