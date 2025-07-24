import pkg from "@adyen/api-library";
const { Client, CheckoutAPI } = pkg;
import { CreateCheckoutSessionRequest } from "@adyen/api-library/lib/src/typings/checkout/createCheckoutSessionRequest";
import { CreateCheckoutSessionResponse } from "@adyen/api-library/lib/src/typings/checkout/createCheckoutSessionResponse";
import type { CartItemWithProduct } from "../lib/cart.server";
import { logger } from "../lib/logger.server";
import { db } from "../lib/db.server";

// Singleton pattern with lazy initialization
class AdyenConnector {
  private static instance: AdyenConnector;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private checkoutApi: any = null;

  private constructor() {
    // Private constructor prevents direct instantiation
  }

  public static getInstance(): AdyenConnector {
    if (!AdyenConnector.instance) {
      AdyenConnector.instance = new AdyenConnector();
    }
    return AdyenConnector.instance;
  }

  private initializeClient(): void {
    if (!this.client) {
      const ADYEN_API_KEY = process.env.ADYEN_API_KEY;
      const ADYEN_ENVIRONMENT = process.env.ADYEN_ENVIRONMENT as "TEST" | "LIVE";

      logger.payment('Initializing Adyen client', { 
        environment: ADYEN_ENVIRONMENT,
        hasApiKey: !!ADYEN_API_KEY 
      });

      if (!ADYEN_API_KEY || !ADYEN_ENVIRONMENT) {
        logger.error('Adyen configuration missing', undefined, { 
          hasApiKey: !!ADYEN_API_KEY, 
          hasEnvironment: !!ADYEN_ENVIRONMENT 
        });
        throw new Error('Adyen API key and environment must be configured');
      }

      this.client = new Client({
        apiKey: ADYEN_API_KEY,
        environment: ADYEN_ENVIRONMENT,
      });

      logger.payment('Adyen client initialized successfully', { environment: ADYEN_ENVIRONMENT });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getCheckoutApi(): any {
    if (!this.checkoutApi) {
      this.initializeClient();
      this.checkoutApi = new CheckoutAPI(this.client!);
    }
    return this.checkoutApi;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getClient(): any {
    this.initializeClient();
    return this.client!;
  }
}

class AdyenService {
    private static instance: AdyenService;
    private adyenConnector: AdyenConnector;     

    private constructor() {
        this.adyenConnector = AdyenConnector.getInstance();
    }

    public static getInstance(): AdyenService {
        if (!AdyenService.instance) {
            AdyenService.instance = new AdyenService();
        }
        return AdyenService.instance;
        }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public getCheckoutApi(): any {
        return this.adyenConnector.getCheckoutApi();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public getClient(): any {
        return this.adyenConnector.getClient();
    }

    public async createPaymentSession(
        paymentRequest: CreateCheckoutSessionRequest, 
        requestOptions?: { idempotencyKey: string }
    ): Promise<CreateCheckoutSessionResponse> {
        logger.payment('Creating Adyen payment session', {
            reference: paymentRequest.reference,
            amount: paymentRequest.amount,
            idempotencyKey: requestOptions?.idempotencyKey
        });

        try {
            let response: CreateCheckoutSessionResponse;
            if (requestOptions?.idempotencyKey) {
                response = await this.adyenConnector.getCheckoutApi().PaymentsApi.sessions(paymentRequest, requestOptions);
            } else {
                response = await this.adyenConnector.getCheckoutApi().PaymentsApi.sessions(paymentRequest);
            }

            logger.payment('Adyen payment session created successfully', {
                sessionId: response.id,
                reference: paymentRequest.reference
            });

            return response;
        } catch (error) {
            logger.error('Failed to create Adyen payment session', error as Error, {
                reference: paymentRequest.reference,
                idempotencyKey: requestOptions?.idempotencyKey
            });
            throw error;
        }
    }
    public async createCheckoutSessionFromCart(
        cartItems: CartItemWithProduct[],
        orderId: string, 
        returnUrl: string,
        userId: string
    ): Promise<{ request: CreateCheckoutSessionRequest; requestOptions: { idempotencyKey: string } }> {
       const user = await db.user.findUnique({
        where: {
            id: userId
        }
       });
      const subtotal = cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
      const tax = subtotal * 0.08; // 8% tax rate
      const total = subtotal + tax;
        
        // Generate a unique idempotency key (max 64 characters for Adyen API)
        const timestamp = Date.now().toString(36);
        const randomPart = Math.random().toString(36).substr(2, 8);
        const orderIdShort = orderId.replace('order_', '').substr(0, 20);
        const idempotencyKey = `${orderIdShort}-${timestamp}-${randomPart}`.substr(0, 64);
        
        logger.payment('Creating checkout session from cart', {
            orderId,
            subtotal,
            tax,
            total,
            itemCount: cartItems.length,
            idempotencyKey
        });

        const request: CreateCheckoutSessionRequest = {
            merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT!,
            amount: {
                value: Math.round(total * 100), // Convert to minor units (cents) - includes tax
                currency: "USD"
            },
            returnUrl: returnUrl,
            reference: orderId,
            countryCode: "US",
            shopperReference: userId,
          shopperEmail: user?.email,
          storePaymentMethod: true,
          recurringProcessingModel: CreateCheckoutSessionRequest.RecurringProcessingModelEnum.CardOnFile,
            shopperInteraction: CreateCheckoutSessionRequest.ShopperInteractionEnum.Ecommerce,
            //allowedPaymentMethods: ["card","paypal"],
            // Optional: Add line items for better receipt
            lineItems: cartItems.map(item => ({
                id: item.product.id,
                description: item.product.name,
                quantity: item.quantity,
                amountIncludingTax: Math.round(item.product.price * item.quantity * 100)
            }))
        };

        logger.payment('Checkout session request created', {
            orderId,
            amount: request.amount,
            lineItemCount: request.lineItems?.length || 0
        });

        return {
            request,
            requestOptions: {
                idempotencyKey
            }
        };
    }

}

export const adyenService = AdyenService.getInstance();