import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireUserId } from "../lib/session.server";
import { getAdyenSessionByOrderId } from "../lib/adyen-session.server";
import { logger } from "../lib/logger.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");

  if (!orderId) {
    return json({ error: "No order ID provided" });
  }

  logger.debug('Debug session route accessed', { userId, orderId });

  const session = await getAdyenSessionByOrderId(orderId, userId);

  if (!session) {
    return json({ error: "Session not found" });
  }

  return json({
    session: {
      id: session.id,
      sessionId: session.sessionId,
      sessionData: session.sessionData,
      sessionDataLength: session.sessionData.length,
      sessionDataPreview: session.sessionData.substring(0, 50) + '...',
      amount: session.amount,
      currency: session.currency,
      countryCode: session.countryCode,
      expiresAt: session.expiresAt,
      reference: session.reference,
      returnUrl: session.returnUrl,
    }
  });
}

export default function DebugSession() {
  const data = useLoaderData<typeof loader>();

  if ('error' in data) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Debug Session</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{data.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Session</h1>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
        <p><strong>Session ID:</strong> {data.session.sessionId}</p>
        <p><strong>Session Data Length:</strong> {data.session.sessionDataLength}</p>
        <p><strong>Session Data Preview:</strong> {data.session.sessionDataPreview}</p>
        <p><strong>Amount:</strong> {data.session.currency} {data.session.amount}</p>
        <p><strong>Country:</strong> {data.session.countryCode}</p>
        <p><strong>Reference:</strong> {data.session.reference}</p>
        <p><strong>Expires At:</strong> {data.session.expiresAt.toString()}</p>
        
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Full Session Data:</h3>
          <pre className="bg-white border border-gray-300 rounded p-2 text-xs overflow-auto max-h-96">
            {data.session.sessionData}
          </pre>
        </div>
      </div>
    </div>
  );
} 