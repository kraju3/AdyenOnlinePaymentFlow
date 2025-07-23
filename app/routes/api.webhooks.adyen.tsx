/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "../lib/db.server";
import { logger } from "../lib/logger.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response(null ,{ status: 405 });
  }

  try {
    const body = await request.text();
    const signature = request.headers.get("adyen-signature");
    
    logger.info('Adyen webhook received', { 
      bodyLength: body.length,
      hasSignature: !!signature 
    });

    // TODO: Verify webhook signature for security
    // const isValidSignature = verifyWebhookSignature(body, signature);
    // if (!isValidSignature) {
    //   logger.error('Invalid webhook signature', undefined, { signature });
    //   return json({ error: "Invalid signature" }, { status: 401 });
    // }

    const notification = JSON.parse(body);
    
    // Handle different notification types
    if (notification.notificationItems && notification.notificationItems.length > 0) {
      for (const item of notification.notificationItems) {
        const notificationRequestItem = item.NotificationRequestItem;
        
        logger.info('Processing notification item', {
          eventCode: notificationRequestItem.eventCode,
          pspReference: notificationRequestItem.pspReference,
          merchantReference: notificationRequestItem.merchantReference,
          success: notificationRequestItem.success
        });

        // Handle payment completion
        if (notificationRequestItem.eventCode === "AUTHORISATION" && notificationRequestItem.success === "true") {
          await handlePaymentSuccess(notificationRequestItem);
        }
        
        // Handle payment failure
        if (notificationRequestItem.eventCode === "AUTHORISATION" && notificationRequestItem.success === "false") {
          await handlePaymentFailure(notificationRequestItem);
        }
      }
    }

    // Always return 200 to acknowledge receipt
    return new Response(null ,{ status: 200 });

  } catch (error) {
    logger.error('Error processing Adyen webhook', error instanceof Error ? error : undefined, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    // Still return 200 to prevent webhook retries
    return new Response(null ,{ status: 200 });
  }
}

async function handlePaymentSuccess(notificationItem: any) {
  const { merchantReference, pspReference, amount } = notificationItem;
  
  try {
    // Find the order by merchant reference (orderId)
    const order = await db.order.findUnique({
      where: { id: merchantReference },
      include: { items: true }
    });

    if (!order) {
      logger.warn('Order not found for successful payment', { 
        merchantReference, 
        pspReference 
      });
      return;
    }

    // Update order status to SUCCESSFUL
    await db.order.update({
      where: { id: merchantReference },
      data: { 
        status: "SUCCESSFUL",
        updatedAt: new Date()
      }
    });

    logger.info('Order status updated to SUCCESSFUL', {
      orderId: merchantReference,
      pspReference,
      amount: amount?.value,
      currency: amount?.currency
    });

  } catch (error) {
    logger.error('Error updating order status to SUCCESSFUL', error instanceof Error ? error : undefined, {
      merchantReference,
      pspReference
    });
  }
}

async function handlePaymentFailure(notificationItem: any) {
  const { merchantReference, pspReference, reason } = notificationItem;
  
  try {
    // Find the order by merchant reference (orderId)
    const order = await db.order.findUnique({
      where: { id: merchantReference }
    });

    if (!order) {
      logger.warn('Order not found for failed payment', { 
        merchantReference, 
        pspReference 
      });
      return;
    }

    // Update order status to FAILED
    await db.order.update({
      where: { id: merchantReference },
      data: { 
        status: "FAILED",
        updatedAt: new Date()
      }
    });

    logger.info('Order status updated to FAILED', {
      orderId: merchantReference,
      pspReference,
      reason
    });

  } catch (error) {
    logger.error('Error updating order status to FAILED', error instanceof Error ? error : undefined, {
      merchantReference,
      pspReference
    });
  }
} 