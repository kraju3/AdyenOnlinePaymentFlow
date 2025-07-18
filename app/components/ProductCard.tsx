import { Link } from "@remix-run/react";
import { ShoppingCart, Star } from "lucide-react";
interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    imageUrl: string;
    category: string;
    stock: number;
  };
  onAddToCart?: (productId: string) => void;
  isLoading?: boolean;
}

export function ProductCard({ product, onAddToCart, isLoading = false }: ProductCardProps) {
  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onAddToCart && !isLoading) {
      onAddToCart(product.id);
    }
  };

  return (
    <div className="group relative bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-200">
      {/* Product Image */}
      <div className="aspect-square overflow-hidden bg-gray-100">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
        />
      </div>

      {/* Product Info */}
      <div className="p-4">
        {/* Category */}
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
          {product.category}
        </div>

        {/* Product Name */}
        <Link to={`/products/${product.id}`} className="block">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
            {product.name}
          </h3>
        </Link>

        {/* Description */}
        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
          {product.description}
        </p>

        {/* Price and Rating */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center space-x-1">
            <Star className="w-4 h-4 text-yellow-400 fill-current" />
            <span className="text-sm text-gray-600">4.8</span>
          </div>
          <span className="text-lg font-bold text-gray-900">
            ${product.price.toFixed(2)}
          </span>
        </div>

        {/* Stock Status */}
        <div className="mt-2">
          {product.stock > 0 ? (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              In Stock ({product.stock})
            </span>
          ) : (
            <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
              Out of Stock
            </span>
          )}
        </div>

        {/* Add to Cart Button */}
        <button
          onClick={handleAddToCart}
          disabled={product.stock === 0 || isLoading}
          className={`mt-3 w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            product.stock > 0 && !isLoading
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>
            {isLoading ? "Adding..." : product.stock > 0 ? "Add to Cart" : "Out of Stock"}
          </span>
        </button>
      </div>
    </div>
  );
} 