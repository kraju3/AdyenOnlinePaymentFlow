import { db } from "./db.server";
import type { CreateCheckoutSessionResponse } from "@adyen/api-library/lib/src/typings/checkout/createCheckoutSessionResponse";
import { logger } from "./logger.server";

export interface StoredAdyenSession {
  id: string;
  userId: string;
  orderId: string;
  sessionId: string;
  sessionData: string;
  amount: number;
  currency: string;
  countryCode: string;
  expiresAt: Date;
  reference: string;
  returnUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function storeAdyenSession(
  userId: string,
  orderId: string,
  sessionResponse: CreateCheckoutSessionResponse
): Promise<StoredAdyenSession> {
  logger.database('Storing Adyen session', { 
    userId, 
    orderId, 
    sessionId: sessionResponse.id,
    sessionDataLength: sessionResponse.sessionData?.length || 0,
    sessionDataPreview: sessionResponse.sessionData?.substring(0, 30) + '...'
  });

  const session = await db.adyenSession.create({
    data: {
      userId,
      orderId,
      sessionId: sessionResponse.id,
      sessionData: sessionResponse.sessionData || '',
      amount: sessionResponse.amount.value / 100, // Convert from minor units
      currency: sessionResponse.amount.currency,
      countryCode: sessionResponse.countryCode || '',
      expiresAt: new Date(sessionResponse.expiresAt!),
      reference: sessionResponse.reference || '',
      returnUrl: sessionResponse.returnUrl || '',
    },
  });

  logger.database('Adyen session stored successfully', { 
    userId, 
    orderId, 
    sessionId: sessionResponse.id,
    sessionDbId: session.id 
  });

  return session;
}

export async function getAdyenSessionByOrderId(
  orderId: string,
  userId: string
): Promise<StoredAdyenSession | null> {
  logger.database('Retrieving Adyen session by order ID', { userId, orderId });
  
  const session = await db.adyenSession.findFirst({
    where: {
      orderId,
      userId,
    },
  });

  if (session) {
    logger.database('Adyen session retrieved successfully', { 
      userId, 
      orderId, 
      sessionId: session.sessionId,
      sessionDataLength: session.sessionData.length,
      sessionDataPreview: session.sessionData.substring(0, 30) + '...'
    });
  } else {
    logger.database('Adyen session not found', { userId, orderId });
  }

  return session;
}

export async function getAdyenSessionBySessionId(
  sessionId: string,
  userId: string
): Promise<StoredAdyenSession | null> {
  const session = await db.adyenSession.findFirst({
    where: {
      sessionId,
      userId,
    },
  });

  return session;
}

export async function deleteAdyenSession(sessionId: string): Promise<void> {
  await db.adyenSession.delete({
    where: {
      sessionId,
    },
  });
}

export async function cleanupExpiredSessions(): Promise<void> {
  await db.adyenSession.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
} 