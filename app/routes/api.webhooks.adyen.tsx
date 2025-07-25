/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionFunctionArgs } from "@remix-run/node";
import { hmacValidator } from "@adyen/api-library";
import { db } from "../lib/db.server";
import { logger } from "../lib/logger.server";
import { cleanupSessionsForOrder } from "../lib/adyen-session.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response(null ,{ status: 405 });
  }

  try {
    const body = await request.text();
    
    logger.info('Adyen webhook received', { 
      bodyLength: body.length
    });

    // Parse the notification request
    const notificationRequest = JSON.parse(body);
    const notificationRequestItems = notificationRequest.notificationItems;

    if (!notificationRequestItems || notificationRequestItems.length === 0) {
      logger.warn('No notification items found in webhook');
      return new Response(null, { status: 400 });
    }

    // Get HMAC key from environment
    const hmacKey = process.env.ADYEN_HMAC_KEY;
    if (!hmacKey) {
      logger.error('ADYEN_HMAC_KEY not configured');
      return new Response(null, { status: 500 });
    }

    // Create validator instance
    const validator = new hmacValidator();

    // Verify HMAC for the first notification item
    const notification = notificationRequestItems[0].NotificationRequestItem;
    
    if (!validator.validateHMAC(notification, hmacKey)) {
      logger.error('Invalid HMAC signature', undefined, { 
        merchantReference: notification.merchantReference,
        eventCode: notification.eventCode 
      });
      return new Response('Invalid HMAC signature', { status: 401 });
    }

    logger.info('HMAC signature validated successfully', {
      merchantReference: notification.merchantReference,
      eventCode: notification.eventCode
    });
    
    // Process the validated notification
    logger.info('Processing notification item', {
      eventCode: notification.eventCode,
      pspReference: notification.pspReference,
      merchantReference: notification.merchantReference,
      success: notification.success
    });

    // Create OrderPayment record for this webhook event
    await createOrderPayment(notification);

    if(notification.eventCode === "CANCEL_OR_REFUND" && notification.success === "true") {
      await handleCancelOrRefund(notification);
    }

    // Handle payment completion
    if (notification.eventCode === "AUTHORISATION" && notification.success === "true") {
      await handlePaymentSuccess(notification);
    }
    
    // Handle payment failure
    if (notification.eventCode === "AUTHORISATION" && notification.success === "false") {
      await handlePaymentFailure(notification);
    }

    // Acknowledge event has been consumed (202 as per Adyen best practices)
    return new Response(null, { status: 202 });

  } catch (error) {
    logger.error('Error processing Adyen webhook', error instanceof Error ? error : undefined, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    // Still return 200 to prevent webhook retries
    return new Response(null ,{ status: 202 });
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

    // Clean up all Adyen sessions for this specific order after successful payment
    try {
      await cleanupSessionsForOrder(merchantReference);
      logger.info('Adyen sessions cleaned up after successful payment', { 
        userId: order.userId, 
        orderId: merchantReference 
      });
    } catch (cleanupError) {
      // Don't fail the webhook processing if cleanup fails
      logger.warn('Failed to cleanup Adyen sessions after payment', { 
        userId: order.userId, 
        orderId: merchantReference, 
        error: cleanupError 
      });
    }

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

async function handleCancelOrRefund(notificationItem: any) {
  const { 
    originalReference, 
    pspReference, 
    amount, 
    additionalData,
    eventCode,
    success 
  } = notificationItem;

  try {
    // Find the original OrderPayment using the originalReference (original payment's pspReference)
    const originalPayment = await db.orderPayment.findUnique({
      where: { pspReference: pspReference },
      include: { order: true }
    });

    if (!originalPayment) {
      logger.warn('Original payment not found for refund/cancel', { 
        originalReference, 
        refundPspReference: pspReference 
      });
      return;
    }

    const orderId = originalPayment.orderId;
    const action = additionalData?.['modification.action'] || 'refund';

    // Only update order status if the refund/cancel was successful
    if (success === "true") {
      const newStatus = action === 'refund' ? 'REFUNDED' : 'CANCELLED';
      
      await db.order.update({
        where: { id: orderId },
        data: { 
          status: newStatus,
          updatedAt: new Date()
        }
      });

      logger.info(`Order status updated to ${newStatus}`, {
        orderId,
        action,
        amount: amount?.value ? amount.value / 100 : 0,
        currency: amount?.currency
      });
    } else {
      logger.warn(`Refund/cancel failed - order status not updated`, {
        orderId,
        originalReference,
        refundPspReference: pspReference,
        action
      });
    }

    // Update the OrderPayment record to reflect the refund/cancel
    await db.orderPayment.update({
      where: { orderId },
      data: {
        eventCode, // Update to CANCEL_OR_REFUND
        success: success === "true",
        reason: `${action}: ${amount?.value ? amount.value / 100 : 0} ${amount?.currency || 'USD'}`,
        rawWebhookData: JSON.stringify(notificationItem),
        updatedAt: new Date()
      }
    });

    logger.info(`Order ${action} webhook processed`, {
      orderId,
      originalReference,
      refundPspReference: pspReference,
      action,
      amount: amount?.value ? amount.value / 100 : 0,
      currency: amount?.currency,
      success: success === "true"
    });

  } catch (error) {
    logger.error('Error processing refund/cancel', error instanceof Error ? error : undefined, {
      originalReference,
      refundPspReference: pspReference
    });
  }
}

async function createOrderPayment(notificationItem: any) {
  const {
    merchantReference,
    merchantAccountCode,
    paymentMethod,
    pspReference,
    reason,
    success,
    eventCode,
    amount,
    eventDate,
    additionalData
  } = notificationItem;

  try {
    // Check if OrderPayment already exists for this order (upsert behavior)
    const existingPayment = await db.orderPayment.findUnique({
      where: { orderId: merchantReference }
    });

    if (existingPayment) {
      // Update existing payment record
      await db.orderPayment.update({
        where: { orderId: merchantReference },
        data: {
          merchantAccountCode,
          merchantReference,
          checkoutSessionId: additionalData?.checkoutSessionId || null,
          paymentMethod,
          pspReference,
          reason: reason || null,
          success: success === "true",
          eventCode,
          amount: amount?.value ? amount.value / 100 : 0, // Convert cents to dollars
          currency: amount?.currency || "USD",
          eventDate: new Date(eventDate),
          rawWebhookData: JSON.stringify(notificationItem),
          updatedAt: new Date()
        }
      });

      logger.info('OrderPayment updated', {
        orderId: merchantReference,
        pspReference,
        eventCode,
        success: success === "true"
      });
    } else {
      // Create new payment record
      await db.orderPayment.create({
        data: {
          orderId: merchantReference,
          merchantAccountCode,
          merchantReference,
          checkoutSessionId: additionalData?.checkoutSessionId || null,
          paymentMethod,
          pspReference,
          reason: reason || null,
          success: success === "true",
          eventCode,
          amount: amount?.value ? amount.value / 100 : 0, // Convert cents to dollars
          currency: amount?.currency || "USD",
          eventDate: new Date(eventDate),
          rawWebhookData: JSON.stringify(notificationItem)
        }
      });

      logger.info('OrderPayment created', {
        orderId: merchantReference,
        pspReference,
        eventCode,
        success: success === "true"
      });
    }

  } catch (error) {
    logger.error('Error creating/updating OrderPayment', error instanceof Error ? error : undefined, {
      merchantReference,
      pspReference,
      eventCode
    });
  }
} 