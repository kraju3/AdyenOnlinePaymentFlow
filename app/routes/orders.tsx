import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useSubmit } from "@remix-run/react";
import { Package, Calendar, CreditCard, Eye, ShoppingBag, RotateCcw } from "lucide-react";
import { requireUserId } from "../lib/session.server";
import { db } from "../lib/db.server";
import { logger } from "../lib/logger.server";
import { adyenService } from "../services/adyen";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  
  const orders = await db.order.findMany({
    where: { userId },
    include: {
      items: {
        include: {
          product: true,
        },
      },
      payment: true, // Include OrderPayment data
    },
    orderBy: { createdAt: "desc" },
  });

  return json({ orders });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const orderId = formData.get("orderId") as string;

  if (!orderId) {
    return json({ error: "Order ID is required" }, { status: 400 });
  }

  try {
    // 1. Get the Order and OrderPayment object
    const order = await db.order.findFirst({
      where: { 
        id: orderId,
        userId, // Ensure user owns this order
      },
      include: {
        payment: true,
      },
    });

    if (!order) {
      return json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.payment) {
      return json({ error: "Payment information not found" }, { status: 404 });
    }

    if (order.status !== "SUCCESSFUL") {
      return json({ error: "Only successful orders can be refunded" }, { status: 400 });
    }
    // 2. Call Adyen refund service (stub for now)
   await adyenService.refundPayment(order.payment);

    // 3. Update Order Status to "REFUND IN PROGRESS"
    await db.order.update({
      where: { id: orderId },
      data: { 
        status: "REFUND IN PROGRESS",
        updatedAt: new Date()
      }
    });

    logger.info('Refund initiated successfully', {
      orderId,
      userId,
      pspReference: order.payment.pspReference,
      amount: order.payment.amount
    });

    return json({ 
      success: true, 
      message: "Refund initiated successfully",
      orderPayment: order.payment 
    });

  } catch (error) {
    logger.error('Error initiating refund', error instanceof Error ? error : undefined, {
      orderId,
      userId
    });

    return json({ error: "Failed to initiate refund" }, { status: 500 });
  }
}


export default function Orders() {
  const { orders } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const handleRefund = (orderId: string) => {
    if (confirm("Are you sure you want to initiate a refund for this order?")) {
      const formData = new FormData();
      formData.set("orderId", orderId);
      submit(formData, { method: "post" });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SUCCESSFUL":
        return "bg-green-100 text-green-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "FAILED":
        return "bg-red-100 text-red-800";
      case "REFUND IN PROGRESS":
        return "bg-orange-100 text-orange-800";
      case "REFUNDED":
        return "bg-purple-100 text-purple-800";
      case "CANCELLED":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "SUCCESSFUL":
        return "✓";
      case "PENDING":
        return "⏳";
      case "FAILED":
        return "✗";
      case "REFUND IN PROGRESS":
        return "🔄";
      case "REFUNDED":
        return "↩️";
      case "CANCELLED":
        return "❌";
      default:
        return "?";
    }
  };

  if (orders.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-gray-400" />
          <h2 className="mt-4 text-lg font-medium text-gray-900">No orders yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            Start shopping to see your orders here.
          </p>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Start Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
        <p className="mt-2 text-sm text-gray-600">
          Track and manage your orders
        </p>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orders.map((order) => (
          <div
            key={order.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
          >
            {/* Order Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Package className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-900">
                    Order #{order.id.slice(-8).toUpperCase()}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                    order.status
                  )}`}
                >
                  <span className="mr-1">{getStatusIcon(order.status)}</span>
                  {order.status}
                </span>
              </div>

              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CreditCard className="w-4 h-4" />
                  <span>${order.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Order Items Preview */}
            <div className="p-6">
              <div className="space-y-3">
                {order.items.slice(0, 2).map((item) => (
                  <div key={item.id} className="flex items-center space-x-3">
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="w-10 h-10 object-cover rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Qty: {item.quantity} × ${item.price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
                {order.items.length > 2 && (
                  <p className="text-xs text-gray-500 text-center">
                    +{order.items.length - 2} more item{order.items.length - 2 > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Order Summary */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
              <div className="flex justify-between items-center text-sm">
                <div>
                  <span className="text-gray-600">Subtotal: </span>
                  <span className="font-medium">${order.subtotal.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Tax: </span>
                  <span className="font-medium">${order.tax.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                <span className="text-base font-semibold text-gray-900">Total</span>
                <span className="text-base font-semibold text-gray-900">
                  ${order.total.toFixed(2)}
                </span>
              </div>
              
              {/* Action Buttons */}
              <div className="mt-4 space-y-2">
                <Link
                  to={`/success?orderId=${order.id}`}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </Link>
                
                {/* Refund Button - Only show for successful orders */}
                {order.status === "SUCCESSFUL" && (
                  <button
                    onClick={() => handleRefund(order.id)}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-orange-300 text-sm font-medium rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Request Refund
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 