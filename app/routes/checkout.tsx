/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";
import { CreditCard, MapPin, ArrowLeft, CheckCircle } from "lucide-react";
import { useToast } from "../contexts/ToastContext";
import { useEffect, useRef, useState } from "react";
import { requireUserId } from "../lib/session.server";
import { getCartItems, calculateCartTotal } from "../lib/cart.server";
import { getAdyenSessionByOrderId } from "../lib/adyen-session.server";
import AdyenDropIn, { AdyenSessionData } from "../components/AdyenDropIn";
import { logger } from "../lib/logger.server";
import { AdyenCheckout } from '@adyen/adyen-web';

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");
  const sessionId = url.searchParams.get("sessionId");
  const redirectResult = url.searchParams.get("redirectResult");

  logger.cart('Checkout page loaded', { 
    userId, 
    orderId: orderId || undefined,
    hasSessionId: !!sessionId,
    hasRedirectResult: !!redirectResult,
    isRedirect: !!(sessionId && redirectResult)
  });

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
    orderId,
    adyenSession: {
      sessionData: adyenSession.sessionData,
      sessionId: adyenSession.sessionId,
      amount: adyenSession.amount,
      currency: adyenSession.currency,
      countryCode: adyenSession.countryCode,
      reference: adyenSession.reference,
      returnUrl: adyenSession.returnUrl,
      environment: process.env.ADYEN_ENVIRONMENT === "TEST" ? 'test' : "live",
      clientKey: process.env.ADYEN_CLIENT_PUBLIC_KEY!
    } as AdyenSessionData,
    // Redirect handling data
    redirectData: sessionId && redirectResult ? {
      sessionId,
      redirectResult
    } : null
  });
}

export default function Checkout() {
  const { cartItems, total, adyenSession, orderId, redirectData } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isHandlingRedirect, setIsHandlingRedirect] = useState(false);
  const redirectHandledRef = useRef(false);

  // Handle redirect result from payment methods like iDEAL, 3D Secure
  useEffect(() => {
    if (redirectData && !redirectHandledRef.current && !isHandlingRedirect) {
      redirectHandledRef.current = true;
      setIsHandlingRedirect(true);
      
      const handleRedirectResult = async () => {
        try {
          console.log('Handling redirect result:', {
            sessionId: redirectData.sessionId,
            hasRedirectResult: !!redirectData.redirectResult
          });

          // Create AdyenCheckout instance with sessionId from redirect
          const checkoutConfig = {
            session: {
              id: redirectData.sessionId,
              sessionData: adyenSession.sessionData
            },
            environment: adyenSession.environment as "test" | "live",
            clientKey: adyenSession.clientKey,
            onPaymentCompleted: async (result: any) => {
              console.log('Redirect payment completed:', result);
              await handlePaymentCompleted(result);
            },
            onPaymentFailed: (result: any) => {
              console.log('Redirect payment failed:', result);
              toast.error(
                "Payment Failed",
                result.resultCode || result.message || "Payment could not be processed",
                5000
              );
              setIsHandlingRedirect(false);
            },
            onError: (error: any) => {
              console.error('Redirect payment error:', error);
              toast.error(
                "Payment Error", 
                error.message || "An error occurred while processing your payment",
                5000
              );
              setIsHandlingRedirect(false);
            }
          };

          const checkout = await AdyenCheckout(checkoutConfig);
          
          // Submit the redirect result
          await checkout.submitDetails({
            details: {
              redirectResult: redirectData.redirectResult
            }
          });

        } catch (error) {
          console.error('Error handling redirect result:', error);
          toast.error(
            "Payment Error",
            "Failed to process payment redirect. Please try again.",
            5000
          );
          setIsHandlingRedirect(false);
        }
      };

      handleRedirectResult();
    }
  }, [redirectData, adyenSession, isHandlingRedirect, toast]);

  const handlePaymentCompleted = async (result: any) => {
    console.log('Payment completed successfully:', result);
    
    toast.success(
      "Payment Successful!",
      "Your payment has been processed. Creating your order...",
      3000
    );
    
    try {
      // Create order with pending status
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          paymentResult: result,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create order');
      }

      const orderData = await response.json();
      console.log('Order created:', orderData);
      
      // Redirect to success page
      navigate(`/success?orderId=${orderData.orderId}`);
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error(
        "Order Creation Failed",
        "Payment completed but there was an issue creating your order. Please contact support.",
        10000
      );
      navigate(`/success?orderId=${orderId}`);
    }
  };

  const handlePaymentFailed = (result: any) => {
    console.log('Payment failed:', result);
    toast.error(
      "Payment Failed",
      `Your payment could not be processed: ${result.resultCode || 'Unknown error'}`,
      8000
    );
  };

  const handlePaymentError = (error: any) => {
    console.error('Payment error:', error);
    toast.error(
      "Payment Error",
      `An error occurred during payment: ${error.message || 'Unknown error'}`,
      8000
    );
  };

  // Debug: Log the session data received from the server
  console.log('Checkout component received adyenSession:', {
    sessionId: adyenSession.sessionId,
    sessionDataLength: adyenSession.sessionData?.length || 0,
    sessionDataPreview: adyenSession.sessionData?.substring(0, 50) + '...',
    amount: adyenSession.amount,
    currency: adyenSession.currency
  });

  // Backend calculated values - tax is already included in adyenSession.amount
  const subtotal = total; // This is the cart subtotal
  const tax = subtotal * 0.08;
  const finalTotal = adyenSession.amount; // This includes tax from backend

  // Show redirect processing state
  if (isHandlingRedirect) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Processing Payment</h1>
          <p className="text-lg text-gray-600 mb-8">
            We&apos;re confirming your payment details. Please wait a moment...
          </p>
          <div className="bg-blue-50 rounded-lg p-6 max-w-md mx-auto">
            <p className="text-sm text-blue-800">
              <strong>Please do not close this page or navigate away.</strong><br />
              Your payment is being processed and you&apos;ll be redirected automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

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
            
            {/* Adyen Drop-in Component */}
            <div className="space-y-4">
              <AdyenDropIn 
                adyenSessionData={adyenSession}
                onPaymentCompleted={handlePaymentCompleted}
                onPaymentFailed={handlePaymentFailed}
                onError={handlePaymentError}
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
                <span className="text-gray-900">${subtotal.toFixed(2)}</span>
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

          {/* Payment Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-800">
                  Complete your payment using the form above. Your order will be processed once payment is successful.
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center">
            By completing your payment, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
} 