import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import { Star, ShoppingCart, ArrowLeft } from "lucide-react";
import { db } from "../lib/db.server";
import { requireUserId } from "../lib/session.server";
import { addToCart } from "../lib/cart.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.product) {
    return [{ title: "Product Not Found" }];
  }
  
  return [
    { title: `${data.product.name} - ShopDrop` },
    { name: "description", content: data.product.description },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const product = await db.product.findUnique({
    where: { id: params.productId },
  });

  if (!product) {
    throw new Response("Not Found", { status: 404 });
  }

  return json({ product });
}

export async function action({ request }: LoaderFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "add-to-cart") {
    const productId = formData.get("productId") as string;
    const quantity = parseInt(formData.get("quantity") as string) || 1;
    
    try {
      const userId = await requireUserId(request);
      await addToCart(userId, productId, quantity);
      return json({ success: true });
    } catch (error) {
      return json({ success: false, error: "Please login to add items to cart" }, { status: 401 });
    }
  }

  return json({ success: false });
}

export default function ProductDetails() {
  const { product } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();

  const handleAddToCart = (quantity: number) => {
    fetcher.submit(
      { intent: "add-to-cart", productId: product.id, quantity: quantity.toString() },
      { method: "post" }
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="mb-8">
        <Link
          to="/"
          className="flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Products
        </Link>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Product Image */}
        <div className="aspect-square overflow-hidden bg-gray-100 rounded-lg">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          {/* Category */}
          <div className="text-sm text-blue-600 font-medium uppercase tracking-wide">
            {product.category}
          </div>

          {/* Product Name */}
          <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>

          {/* Rating */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-5 h-5 ${
                    i < 4 ? "text-yellow-400 fill-current" : "text-gray-300"
                  }`}
                />
              ))}
            </div>
            <span className="text-sm text-gray-600">4.8 (128 reviews)</span>
          </div>

          {/* Price */}
          <div className="text-3xl font-bold text-gray-900">
            ${product.price.toFixed(2)}
          </div>

          {/* Stock Status */}
          <div className="flex items-center space-x-2">
            {product.stock > 0 ? (
              <span className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                In Stock ({product.stock} available)
              </span>
            ) : (
              <span className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded-full">
                Out of Stock
              </span>
            )}
          </div>

          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
            <p className="text-gray-600 leading-relaxed">{product.description}</p>
          </div>

          {/* Add to Cart Section */}
          {product.stock > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <label htmlFor="quantity" className="text-sm font-medium text-gray-700">
                  Quantity:
                </label>
                <select
                  id="quantity"
                  name="quantity"
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue="1"
                >
                  {[...Array(Math.min(10, product.stock))].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              <fetcher.Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value="add-to-cart" />
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="quantity" value="1" id="quantity-input" />
                
                <button
                  type="submit"
                  disabled={fetcher.state === "submitting"}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  onClick={(e) => {
                    e.preventDefault();
                    const quantity = parseInt((document.getElementById('quantity') as HTMLSelectElement).value);
                    handleAddToCart(quantity);
                  }}
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span>
                    {fetcher.state === "submitting" ? "Adding to Cart..." : "Add to Cart"}
                  </span>
                </button>
              </fetcher.Form>

                             {fetcher.data?.success && (
                 <div className="text-green-600 text-sm text-center">
                   ✓ Added to cart successfully!
                 </div>
               )}

               {fetcher.data?.error && (
                 <div className="text-red-600 text-sm text-center">
                   {fetcher.data.error}
                 </div>
               )}
            </div>
          )}

          {/* Product Features */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Features</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-600 rounded-full mr-3"></span>
                High-quality materials
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-600 rounded-full mr-3"></span>
                Fast shipping available
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-600 rounded-full mr-3"></span>
                30-day return policy
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-600 rounded-full mr-3"></span>
                Customer support included
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 