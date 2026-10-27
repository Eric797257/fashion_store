import { ProductCard } from "@/components/store/product-card";
import type { ProductCardData } from "@/server/catalog/types";

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product, index) => (
        <li key={product.id}>
          {/* The first row is above the fold, so its images load first */}
          <ProductCard product={product} priority={index < 4} />
        </li>
      ))}
    </ul>
  );
}