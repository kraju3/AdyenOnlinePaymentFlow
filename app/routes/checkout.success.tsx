import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { CheckCircle, Package, Mail, ArrowRight } from "lucide-react";
import { requireUserId } from "../lib/session.server";
import { db } from "../lib/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");

  if (!orderId) {
    throw new Response("Order not found", { status: 404 });
  }

  const order = await db.order.findUnique({
    where: { id: orderId, userId },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    throw new Response("Order not found", { status: 404 });
  }

  return json({ order });
}

export default function CheckoutSuccess() {
  const { order } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center">
        {/* Success Icon */}
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>

        {/* Success Message */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Thank you for your order!
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Your order has been successfully placed and is being processed.
        </p>

        {/* Order Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Order Number</h3>
              <p className="text-lg font-mono text-gray-900">{order.id}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Order Date</h3>
              <p className="text-lg text-gray-900">
                {new Date(order.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Amount</h3>
              <p className="text-lg font-semibold text-gray-900">
                ${order.total.toFixed(2)}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Status</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {order.status}
              </span>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Items</h2>
          
          <div className="space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center space-x-4">
                <img
                  src={item.product.imageUrl}
                  alt={item.product.name}
                  className="w-16 h-16 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">{item.product.name}</h3>
                  <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                </div>
                <p className="text-sm font-medium text-gray-900">
                  ${(item.price * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{"What's Next?"}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-3">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
                             <h3 className="text-sm font-medium text-gray-900 mb-1">Order Confirmation</h3>
               <p className="text-xs text-gray-600">
                 You&apos;ll receive an email confirmation with your order details.
               </p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-3">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
                             <h3 className="text-sm font-medium text-gray-900 mb-1">Processing</h3>
               <p className="text-xs text-gray-600">
                 We&apos;ll process your order and prepare it for shipping.
               </p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-3">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
                             <h3 className="text-sm font-medium text-gray-900 mb-1">Shipping</h3>
               <p className="text-xs text-gray-600">
                 You&apos;ll receive tracking information once your order ships.
               </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Continue Shopping
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
          
          <Link
            to="/orders"
            className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            View Orders
          </Link>
        </div>

        <p className="mt-8 text-sm text-gray-500">
          If you have any questions about your order, please contact our customer support.
        </p>
      </div>
    </div>
  );
} 