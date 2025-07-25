import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { CheckCircle, Package, Mail, ArrowRight, Clock, XCircle, RotateCcw, RefreshCw, AlertCircle } from "lucide-react";
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

// Helper functions for status-based content
function getStatusIcon(status: string) {
  switch (status) {
    case "SUCCESSFUL":
      return { icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-100" };
    case "PENDING":
      return { icon: Clock, color: "text-yellow-600", bgColor: "bg-yellow-100" };
    case "FAILED":
      return { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100" };
    case "REFUND IN PROGRESS":
      return { icon: RefreshCw, color: "text-orange-600", bgColor: "bg-orange-100" };
    case "REFUNDED":
      return { icon: RotateCcw, color: "text-purple-600", bgColor: "bg-purple-100" };
    case "CANCELLED":
      return { icon: AlertCircle, color: "text-gray-600", bgColor: "bg-gray-100" };
    default:
      return { icon: Clock, color: "text-yellow-600", bgColor: "bg-yellow-100" };
  }
}

function getStatusContent(status: string) {
  switch (status) {
    case "SUCCESSFUL":
      return {
        title: "Payment Successful!",
        description: "Your payment has been processed successfully and your order is confirmed. We'll start processing your order right away."
      };
    case "PENDING":
      return {
        title: "Order Placed!",
        description: "Your order has been placed and payment is being processed. You'll receive confirmation once payment is complete."
      };
    case "FAILED":
      return {
        title: "Payment Failed",
        description: "Unfortunately, your payment could not be processed. Please try again or contact customer support for assistance."
      };
    case "REFUND IN PROGRESS":
      return {
        title: "Refund in Progress",
        description: "Your refund request has been initiated and is currently being processed. You'll receive confirmation once the refund is complete."
      };
    case "REFUNDED":
      return {
        title: "Order Refunded",
        description: "Your order has been successfully refunded. The amount will be credited back to your original payment method within 3-5 business days."
      };
    case "CANCELLED":
      return {
        title: "Order Cancelled",
        description: "This order has been cancelled. If you have any questions about this cancellation, please contact our customer support."
      };
    default:
      return {
        title: "Order Placed!",
        description: "Your order has been placed and is being processed."
      };
  }
}

function getNextSteps(status: string) {
  switch (status) {
    case "SUCCESSFUL":
      return [
        {
          icon: Mail,
          title: "Order Confirmation",
          description: "You'll receive an email confirmation with your order details."
        },
        {
          icon: Package,
          title: "Processing",
          description: "We'll process your order and prepare it for shipping."
        },
        {
          icon: CheckCircle,
          title: "Shipping",
          description: "You'll receive tracking information once your order ships."
        }
      ];
    case "PENDING":
      return [
        {
          icon: Clock,
          title: "Payment Processing",
          description: "Your payment is being verified and processed."
        },
        {
          icon: Mail,
          title: "Confirmation Email",
          description: "You'll receive an email once payment is confirmed."
        },
        {
          icon: Package,
          title: "Order Processing",
          description: "Once payment is confirmed, we'll process your order."
        }
      ];
    case "FAILED":
      return [
        {
          icon: RefreshCw,
          title: "Try Again",
          description: "You can retry your payment or use a different payment method."
        },
        {
          icon: Mail,
          title: "Contact Support",
          description: "Our team is here to help if you continue experiencing issues."
        },
        {
          icon: Package,
          title: "Alternative Options",
          description: "Consider different payment methods or contact us for assistance."
        }
      ];
    case "REFUND IN PROGRESS":
      return [
        {
          icon: RefreshCw,
          title: "Processing Refund",
          description: "Your refund is being processed by our payment provider."
        },
        {
          icon: Mail,
          title: "Confirmation Email",
          description: "You'll receive an email once the refund is processed."
        },
        {
          icon: CheckCircle,
          title: "Credit to Account",
          description: "Funds will be credited to your original payment method."
        }
      ];
    case "REFUNDED":
      return [
        {
          icon: CheckCircle,
          title: "Refund Complete",
          description: "Your refund has been successfully processed."
        },
        {
          icon: Mail,
          title: "Email Confirmation",
          description: "Check your email for refund confirmation details."
        },
        {
          icon: Package,
          title: "Shop Again",
          description: "Browse our products for your next purchase."
        }
      ];
    case "CANCELLED":
      return [
        {
          icon: RefreshCw,
          title: "Place New Order",
          description: "You can place a new order anytime you're ready."
        },
        {
          icon: Mail,
          title: "Contact Support",
          description: "Reach out if you have questions about the cancellation."
        },
        {
          icon: Package,
          title: "Browse Products",
          description: "Explore our product catalog for future purchases."
        }
      ];
    default:
      return [
        {
          icon: Mail,
          title: "Check Email",
          description: "Look for updates about your order status."
        },
        {
          icon: Package,
          title: "Order Updates",
          description: "We'll keep you informed about any changes."
        },
        {
          icon: CheckCircle,
          title: "Customer Support",
          description: "Contact us if you have any questions."
        }
      ];
  }
}

export default function CheckoutSuccess() {
  const { order } = useLoaderData<typeof loader>();
  
  const statusIcon = getStatusIcon(order.status);
  const statusContent = getStatusContent(order.status);
  const nextSteps = getNextSteps(order.status);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center">
        {/* Status Icon */}
        <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full ${statusIcon.bgColor} mb-6`}>
          <statusIcon.icon className={`h-8 w-8 ${statusIcon.color}`} />
        </div>

        {/* Status Message */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          {statusContent.title}
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          {statusContent.description}
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
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                order.status === "SUCCESSFUL" 
                  ? "bg-green-100 text-green-800"
                  : order.status === "FAILED"
                  ? "bg-red-100 text-red-800"
                  : order.status === "REFUND IN PROGRESS"
                  ? "bg-orange-100 text-orange-800"
                  : order.status === "REFUNDED"
                  ? "bg-purple-100 text-purple-800"
                  : order.status === "CANCELLED"
                  ? "bg-gray-100 text-gray-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}>
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
            {nextSteps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-3">
                  <step.icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-900 mb-1">{step.title}</h3>
                <p className="text-xs text-gray-600">
                  {step.description}
                </p>
              </div>
            ))}
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