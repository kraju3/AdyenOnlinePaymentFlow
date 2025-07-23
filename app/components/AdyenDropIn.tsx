/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdyenCheckout, CoreConfiguration, Dropin, Klarna,Card,PayPal, ApplePay, GooglePay } from '@adyen/adyen-web';
import '@adyen/adyen-web/styles/adyen.css';
import { logger } from '../lib/logger.client';

interface AdyenDropInProps {
  adyenSessionData: AdyenSessionData;
  onPaymentCompleted?: (result: any) => Promise<void>;
  onPaymentFailed?: (result: any) => void;
  onError?: (error: any) => void;
}
export interface AdyenSessionData {
  sessionData: string;
  sessionId: string;
  amount: number;
  currency: string;
  countryCode: string;
  reference: string;
  returnUrl: string;
  environment: string;
  clientKey: string;
}

  const useAdyenGlobalConfig = (
  adyenSessionData: AdyenSessionData,
  onPaymentCompleted?: (result: any) => Promise<void>,
  onPaymentFailed?: (result: any) => void,
  onError?: (error: any) => void,
  setErrorMessage?: (message: string | null) => void
) => {
  return useMemo(() => {
    const config: CoreConfiguration = {
      session: {
        id: adyenSessionData.sessionId,
        sessionData: adyenSessionData.sessionData
      },
      environment: adyenSessionData.environment as "test" | "live",
      amount: {
        value: adyenSessionData.amount,
        currency: adyenSessionData.currency
      },
      //allowedPaymentMethods: ["card","paypal"],
      countryCode: adyenSessionData.countryCode,
      locale: 'en-US',
      clientKey: adyenSessionData.clientKey,
      onPaymentCompleted: async (result: any, component: any) => {
        logger.info('Payment completed:', result, component);
        await onPaymentCompleted?.(result);
      },
      onPaymentFailed: (result: any, component: any) => {
        logger.info('Payment failed:', result, component);
        const errorMsg = result.resultCode || result.message || 'Payment failed';
        setErrorMessage?.(errorMsg);
        onPaymentFailed?.(result);
      },
      onError: (error: any, component?: any) => {
        logger.error('Payment error:', error.name, error.message, error.stack, component);
        const errorMsg = error.message || error.name || 'Payment error occurred';
        setErrorMessage?.(errorMsg);
        onError?.(error);
      }
    };
    return config;
  }, [adyenSessionData, onPaymentCompleted, onPaymentFailed, onError, setErrorMessage]);
};

export default function AdyenDropIn({
  adyenSessionData,
  onPaymentCompleted,
  onPaymentFailed,
  onError
}: AdyenDropInProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dropinRef = useRef<Dropin | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const adyenGlobalConfig = useAdyenGlobalConfig(adyenSessionData, onPaymentCompleted, onPaymentFailed, onError, setErrorMessage);

  useEffect(() => {
    let isMounted = true;
    let dropinInstance: Dropin | null = null;
    
    const loadAdyenDropIn = async () => {
      try {
        logger.info('Loading Adyen Drop-in with session:', {
          sessionDataLength: adyenSessionData.sessionData.length,
          sessionId: adyenSessionData.sessionId,
          amount: adyenSessionData.amount,
          currency: adyenSessionData.currency,
          countryCode: adyenSessionData.countryCode
        });

        // Check if component is still mounted before proceeding
        if (!isMounted || !containerRef.current) {
          return;
        }

        // Initialize Adyen Checkout and create Drop-in
        const checkout = await AdyenCheckout(adyenGlobalConfig);
        
        // Check again if component is still mounted
        if (!isMounted || !containerRef.current) {
          return;
        }

        dropinInstance = new Dropin(checkout, {
          paymentMethodsConfiguration: {
            card: {
              hasHolderName: false,
              holderNameRequired: false,
              enableStoreDetails: true,
              hideCVC: false,
              name: 'Credit or debit card'
            },
          },
          instantPaymentTypes:['googlepay','applepay'],
          paymentMethodComponents:[Card,Klarna,ApplePay,GooglePay]
        });
        
        dropinInstance.mount(containerRef.current);
        dropinRef.current = dropinInstance;

      } catch (error) {
        logger.error('Failed to load Adyen Drop-in:', error);
        
        // Only show fallback if component is still mounted
        if (isMounted && containerRef.current) {
          containerRef.current.innerHTML = `
            <div class="p-6 text-center">
              <h3 class="text-lg font-medium text-gray-900 mb-2">Adyen Drop-in Component</h3>
              <p class="text-sm text-gray-600 mb-4">Failed to load payment form</p>
              <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <p class="text-xs text-red-800">
                  <strong>Error:</strong> ${error instanceof Error ? error.message : 'Unknown error'}<br>
                  <strong>Session ID:</strong> ${adyenSessionData.sessionId}<br>
                  <strong>Amount:</strong> ${adyenSessionData.currency} ${adyenSessionData.amount.toFixed(2)}
                </p>
              </div>
            </div>
          `;
        }
      }
    };

    loadAdyenDropIn();

    // Cleanup function
    return () => {
      isMounted = false;
      
      // Safely unmount the dropin
      if (dropinInstance) {
        try {
          dropinInstance.unmount();
        } catch (error) {
          logger.warn('Error unmounting Adyen Drop-in:', error);
        }
        dropinInstance = null;
      }
      
      // Also clear the ref
      if (dropinRef.current) {
        dropinRef.current = null;
      }
    };
  }, [adyenSessionData, adyenGlobalConfig]);

  return (
    <div className="adyen-drop-in-wrapper">
      {errorMessage && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{errorMessage}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setErrorMessage(null)}
                className="inline-flex text-red-400 hover:text-red-600"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      <div id="dropin-container" ref={containerRef} className="adyen-drop-in-container" />
    </div>
  );
} 