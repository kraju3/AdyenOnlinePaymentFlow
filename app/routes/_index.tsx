import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { db } from "../lib/db.server";
import { requireUserId } from "../lib/session.server";
import { ProductCard } from "../components/ProductCard";
import { addToCart } from "../lib/cart.server";


export const meta: MetaFunction = () => {
  return [
    { title: "ShopRun - Modern Shopping Experience" },
    { name: "description", content: "Discover amazing products with our modern shopping experience" },
  ];
};

export async function loader() {
  const products = await db.product.findMany({
    orderBy: { createdAt: "desc" },
  });

  return json({ products });
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

export default function Index() {
  const { products } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  
  type Product = typeof products[0];

  const handleAddToCart = (productId: string) => {
    fetcher.submit(
      { intent: "add-to-cart", productId, quantity: "1" },
      { method: "post" }
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to ShopRun
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Discover amazing products with our modern shopping experience. 
          Quality items, fast delivery, and exceptional service.
        </p>
      </div>

      {/* Featured Products */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">
          Featured Products
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product: Product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={handleAddToCart}
              isLoading={fetcher.state === "submitting"}
            />
          ))}
        </div>
      </div>

      {/* Categories Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">
          Shop by Category
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {["Electronics", "Clothing", "Home & Garden", "Accessories"].map((category) => (
            <div
              key={category}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center hover:shadow-md transition-shadow cursor-pointer"
            >
              <h3 className="text-lg font-medium text-gray-900 mb-2">{category}</h3>
              <p className="text-sm text-gray-600">
                {products.filter((p) => p.category === category).length} products
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
