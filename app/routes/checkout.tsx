import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import { CreditCard, MapPin, ArrowLeft, CheckCircle } from "lucide-react";
import { requireUserId } from "../lib/session.server";
import { getCartItems, calculateCartTotal, clearCart } from "../lib/cart.server";
import { db } from "../lib/db.server";
import { getAdyenSessionByOrderId } from "../lib/adyen-session.server";
import AdyenDropIn from "../components/AdyenDropIn";
import { logger } from "../lib/logger.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");

  logger.cart('Checkout page loaded', { userId, orderId: orderId || undefined });

  if (!orderId) {
    logger.cart('No order ID provided, redirecting to cart', { userId });
    return redirect("/cart");
  }

  // Get the stored Adyen session data
  const adyenSession = await getAdyenSessionByOrderId(orderId, userId);
  
  if (!adyenSession) {
    logger.cart('Adyen session not found, redirecting to cart', { userId, orderId });
    return redirect("/cart");
  }

  // Check if session has expired
  if (new Date() > adyenSession.expiresAt) {
    logger.cart('Adyen session expired, redirecting to cart', { userId, orderId, expiresAt: adyenSession.expiresAt });
    return redirect("/cart?error=session-expired");
  }

  const cartItems = await getCartItems(userId);
  const total = calculateCartTotal(cartItems);

  if (cartItems.length === 0) {
    logger.cart('Cart is empty, redirecting to cart', { userId, orderId });
    return redirect("/cart");
  }

  logger.cart('Checkout page data loaded successfully', { 
    userId, 
    orderId, 
    sessionId: adyenSession.sessionId,
    sessionDataLength: adyenSession.sessionData.length,
    itemCount: cartItems.length,
    total 
  });

  return json({ 
    cartItems, 
    total, 
    adyenSession: {
      sessionData: adyenSession.sessionData,
      sessionId: adyenSession.sessionId,
      amount: adyenSession.amount,
      currency: adyenSession.currency,
      countryCode: adyenSession.countryCode,
      expiresAt: adyenSession.expiresAt,
      reference: adyenSession.reference,
      returnUrl: adyenSession.returnUrl,
    }
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "place-order") {
    const cartItems = await getCartItems(userId);
    const total = calculateCartTotal(cartItems);

    // Create order
    const order = await db.order.create({
      data: {
        userId,
        total: total + total * 0.08, // Including tax
        items: {
          create: cartItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.price,
          })),
        },
      },
    });

    // Clear cart
    await clearCart(userId);

    return redirect(`/checkout/success?orderId=${order.id}`);
  }

  return json({ success: false });
}

export default function Checkout() {
  const { cartItems, total, adyenSession } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  // Debug: Log the session data received from the server
  console.log('Checkout component received adyenSession:', {
    sessionId: adyenSession.sessionId,
    sessionDataLength: adyenSession.sessionData?.length || 0,
    sessionDataPreview: adyenSession.sessionData?.substring(0, 50) + '...',
    amount: adyenSession.amount,
    currency: adyenSession.currency
  });

  const tax = total * 0.08;
  const finalTotal = total + tax;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Link
          to="/cart"
          className="flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Cart
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Checkout Form */}
        <div className="space-y-8">
          {/* Shipping Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-2 mb-4">
              <MapPin className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-medium text-gray-900">Shipping Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700 mb-1">
                  ZIP Code
                </label>
                <input
                  type="text"
                  id="zipCode"
                  name="zipCode"
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-2 mb-4">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-medium text-gray-900">Payment Information</h2>
            </div>
            
            {/* Adyen Drop-in Component will be rendered here */}
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-sm text-gray-600 text-center">
                  Adyen Drop-in Component will be integrated here
                </p>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Session ID: {adyenSession.sessionId}
                </p>
                <p className="text-xs text-gray-500 text-center">
                  Amount: {adyenSession.currency} {adyenSession.amount.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 text-center">
                  Session Data: {adyenSession.sessionData ? `Available (${adyenSession.sessionData.length} chars)` : 'Missing'}
                </p>
                {adyenSession.sessionData && (
                  <p className="text-xs text-gray-400 text-center mt-1 break-all">
                    Preview: {adyenSession.sessionData.substring(0, 30)}...
                  </p>
                )}
              </div>
              
              {/* Adyen Drop-in Component */}
              <AdyenDropIn
                sessionData={adyenSession.sessionData}
                sessionId={adyenSession.sessionId}
                amount={adyenSession.amount}
                currency={adyenSession.currency}
                countryCode={adyenSession.countryCode}
                onPaymentComplete={(result) => {
                  console.log('Payment completed:', result);
                  // Handle successful payment
                }}
                onError={(error) => {
                  console.error('Payment error:', error);
                  // Handle payment error
                }}
              />
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h2>
            
            {/* Cart Items */}
            <div className="space-y-4 mb-6">
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center space-x-4">
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    className="w-12 h-12 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">{item.product.name}</h3>
                    <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    ${(item.product.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            {/* Price Breakdown */}
            <div className="border-t border-gray-200 pt-4 space-y-2">
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
                <span className="text-gray-900">${tax.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2">
                <div className="flex justify-between text-base font-medium">
                  <span className="text-gray-900">Total</span>
                  <span className="text-gray-900">${finalTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Place Order Button */}
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="place-order" />
            <button
              type="submit"
              disabled={fetcher.state === "submitting"}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <CheckCircle className="w-5 h-5" />
              <span>
                {fetcher.state === "submitting" ? "Processing..." : `Place Order - $${finalTotal.toFixed(2)}`}
              </span>
            </button>
          </fetcher.Form>

          <p className="text-xs text-gray-500 text-center">
            By placing your order, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
} 