/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "../lib/session.server";
import { getCartItems, calculateCartTotal, clearCart } from "../lib/cart.server";
import { db } from "../lib/db.server";
import { logger } from "../lib/logger.server";
import { cleanupSessionsForOrder } from "../lib/adyen-session.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const userId = await requireUserId(request);
    const { orderId, paymentResult } = await request.json();

    logger.info('Creating order after payment completion', { 
      userId, 
      orderId, 
      paymentResultCode: paymentResult?.resultCode,
      paymentPspReference: paymentResult?.pspReference 
    });

    // Get cart items
    const cartItems = await getCartItems(userId);
    const subtotal = calculateCartTotal(cartItems);
    const tax = subtotal * 0.08; // 8% tax rate
    const total = subtotal + tax;

    if (cartItems.length === 0) {
      logger.info('No cart items found for order creation', { userId, orderId });
      return json({ error: "No items in cart" }, { status: 400 });
    }

    // Create order with PENDING status
    const order = await db.order.create({
      data: {
        id: orderId, // Use the provided orderId
        userId,
        status: "PENDING", // Will be updated to SUCCESSFUL via webhook
        subtotal,
        tax,
        total,
        items: {
          create: cartItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.price,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Clear the cart after successful order creation
    await clearCart(userId);

    // Clean up all Adyen sessions for this specific order after successful creation
    try {
      await cleanupSessionsForOrder(orderId);
      logger.info('Adyen sessions cleaned up after order creation', { userId, orderId: order.id });
    } catch (cleanupError) {
      // Don't fail the order if cleanup fails
      logger.warn('Failed to cleanup Adyen sessions for order', { userId, orderId: order.id, error: cleanupError });
    }

    logger.info('Order created successfully', { 
      userId, 
      orderId: order.id, 
      itemCount: order.items.length,
      total: order.total 
    });

    return json({ 
      success: true, 
      orderId: order.id,
      message: "Order created successfully" 
    });

  } catch (error) {
    logger.error('Error creating order', error instanceof Error ? error : undefined, { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return json({ 
      error: "Failed to create order" 
    }, { status: 500 });
  }
} 