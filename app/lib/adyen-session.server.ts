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

export async function cleanupOldUserSessions(userId: string, keepSessionId?: string): Promise<void> {
  logger.database('Cleaning up old Adyen sessions for user', { userId, keepSessionId });
  
  const deleteCondition: {
    userId: string;
    sessionId?: { not: string };
  } = {
    userId,
  };
  
  // If we want to keep a specific session, exclude it from deletion
  if (keepSessionId) {
    deleteCondition.sessionId = {
      not: keepSessionId,
    };
  }
  
  const deletedSessions = await db.adyenSession.deleteMany({
    where: deleteCondition,
  });
  
  logger.database('Old Adyen sessions cleaned up', { 
    userId, 
    deletedCount: deletedSessions.count,
    keptSessionId: keepSessionId 
  });
}

export async function cleanupSessionsForOrder(orderId: string, keepSessionId?: string): Promise<void> {
  logger.database('Cleaning up Adyen sessions for specific order', { orderId, keepSessionId });
  
  // First, find all sessions for this order
  const existingSessions = await db.adyenSession.findMany({
    where: { orderId },
    select: { sessionId: true, userId: true, createdAt: true },
  });
  
  if (existingSessions.length === 0) {
    logger.database('No existing sessions found for order', { orderId });
    return;
  }
  
  // Determine which sessions to delete
  const sessionsToDelete = keepSessionId 
    ? existingSessions.filter(session => session.sessionId !== keepSessionId)
    : existingSessions; // Delete all if no specific session to keep
  
  if (sessionsToDelete.length === 0) {
    logger.database('No sessions to delete for order', { orderId, keepSessionId });
    return;
  }
  
  // Delete the old sessions
  const deletedSessions = await db.adyenSession.deleteMany({
    where: {
      orderId,
      sessionId: keepSessionId ? {
        not: keepSessionId,
      } : undefined,
    },
  });
  
  logger.database('Adyen sessions cleaned up for order', { 
    orderId,
    deletedCount: deletedSessions.count,
    keptSessionId: keepSessionId,
    totalSessionsFound: existingSessions.length
  });
}