import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import { Trash2, Minus, Plus, ArrowLeft, ShoppingBag } from "lucide-react";
import { requireUserId } from "../lib/session.server";
import { getCartItems, updateCartItemQuantity, removeFromCart, calculateCartTotal } from "../lib/cart.server";
import { adyenService } from "../services/adyen";
import { storeAdyenSession } from "../lib/adyen-session.server";
import { logger } from "../lib/logger.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const cartItems = await getCartItems(userId);
  const total = calculateCartTotal(cartItems);

  return json({ cartItems, total });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  logger.cart('Cart action triggered', { userId, intent });

  if (intent === "update-quantity") {
    const cartItemId = formData.get("cartItemId") as string;
    const quantity = parseInt(formData.get("quantity") as string);
    
    await updateCartItemQuantity(cartItemId, quantity);
    return json({ success: true });
  }

  if (intent === "remove-item") {
    const cartItemId = formData.get("cartItemId") as string;
    await removeFromCart(cartItemId);
    return json({ success: true });
  }

  if (intent === "checkout") {
    logger.cart('Starting checkout process', { userId });
    
    // Get cart items for the user
    const cartItems = await getCartItems(userId);
    
    if (cartItems.length === 0) {
      logger.cart('Checkout failed: empty cart', { userId });
      return json({ error: "Cart is empty" }, { status: 400 });
    }

    try {
      // Generate unique order ID
      const orderId = `order_${userId}_${Date.now()}`;
      
      logger.cart('Generated order ID', { userId, orderId, itemCount: cartItems.length });
      
      // Create return URL for after payment
      //URL encoded
      const returnUrl = encodeURIComponent(`${new URL(request.url).origin}/success?orderId=${orderId}`);
      
      // Create checkout session request from cart data
      const { request: checkoutSessionRequest, requestOptions } = await adyenService.createCheckoutSessionFromCart(
        cartItems,
        orderId,  
        returnUrl,
        userId
      );
      
      // Create payment session with Adyen (including idempotency key)
      const paymentSession = await adyenService.createPaymentSession(checkoutSessionRequest, requestOptions);
      
      // Store the session data securely in the database
      if (paymentSession.sessionData) {
        logger.cart('Storing Adyen session in database', { userId, orderId, sessionId: paymentSession.id });
        await storeAdyenSession(userId, orderId, paymentSession);
        
        // Redirect to our checkout page with the order ID
        logger.cart('Redirecting to checkout page', { userId, orderId });
        return redirect(`/checkout?orderId=${orderId}`);
      } else {
        throw new Error('No session data received from Adyen');
      }
      
    } catch (error) {
      logger.error('Failed to create checkout session', error as Error, { userId });
      return json({ error: "Failed to create checkout session" }, { status: 500 });
    }
  }

  return json({ success: false });
}

export default function Cart() {
  const { cartItems, total } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ error?: string }>();

  const handleQuantityChange = (cartItemId: string, newQuantity: number) => {
    fetcher.submit(
      { intent: "update-quantity", cartItemId, quantity: newQuantity.toString() },
      { method: "post" }
    );
  };

  const handleRemoveItem = (cartItemId: string) => {
    fetcher.submit(
      { intent: "remove-item", cartItemId },
      { method: "post" }
    );
  };

  if (cartItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-gray-400" />
          <h2 className="mt-4 text-lg font-medium text-gray-900">Your cart is empty</h2>
          <p className="mt-2 text-sm text-gray-500">
            Start shopping to add items to your cart.
          </p>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Link
            to="/"
            className="flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Continue Shopping
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Shopping Cart</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                Cart Items ({cartItems.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-200">
              {cartItems.map((item) => (
                <div key={item.id} className="p-6">
                  <div className="flex items-center space-x-4">
                    {/* Product Image */}
                    <div className="flex-shrink-0">
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {item.product.name}
                      </h3>
                      <p className="text-sm text-gray-500">{item.product.category}</p>
                      <p className="text-sm font-medium text-gray-900">
                        ${item.product.price.toFixed(2)}
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="p-1 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        disabled={item.quantity >= item.product.stock}
                        className="p-1 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Item Total */}
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        ${(item.product.price * item.quantity).toFixed(2)}
                      </p>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-gray-900">${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Shipping</span>
                <span className="text-gray-900">Free</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax</span>
                <span className="text-gray-900">${(total * 0.08).toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between text-base font-medium">
                  <span className="text-gray-900">Total</span>
                  <span className="text-gray-900">
                    ${(total + total * 0.08).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <fetcher.Form method="post" className="mt-6">
              <input type="hidden" name="intent" value="checkout" />
              <button
                type="submit"
                disabled={fetcher.state === "submitting"}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {fetcher.state === "submitting" ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creating Checkout Session...</span>
                  </>
                ) : (
                  "Proceed to Checkout"
                )}
              </button>
            </fetcher.Form>

            {fetcher.data?.error && (
              <div className="mt-4 text-red-600 text-sm text-center">
                {fetcher.data.error}
              </div>
            )}

            <p className="mt-4 text-xs text-gray-500 text-center">
              Secure checkout powered by ShopDrop
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 