import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { emitWalletUpdated } from '../wallet/wallet-events';

@Injectable()
export class PaymongoService {
  private secretKey = process.env.PAYMONGO_SECRET_KEY || '';
  private webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET || '';
  private baseUrl = 'https://api.paymongo.com/v1';
  private auth = Buffer.from(`${this.secretKey}:`).toString('base64');

  constructor(private prisma: PrismaService) {}

  private async makeRequest(
    method: string,
    endpoint: string,
    body?: Record<string, any>,
  ) {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.errors?.[0]?.message || data.error || 'Unknown error';
        console.error(`[PaymongoService] API Error:`, {
          status: response.status,
          url,
          method,
          error: errorMessage,
          fullResponse: JSON.stringify(data),
        });
        throw new Error(`PayMongo API Error: ${errorMessage}`);
      }

      return data.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[PaymongoService] Request Error: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  async createPaymentIntent(data: {
    amount: number;
    currency: string;
    description: string;
    metadata: Record<string, any>;
  }) {
    return this.makeRequest('POST', '/payment_intents', {
      data: {
        attributes: {
          amount: Math.round(data.amount * 100),
          currency: data.currency,
          description: data.description,
          metadata: data.metadata,
          statement_descriptor: 'ChatMoo',
          payment_method_allowed: ['card', 'gcash', 'paymaya', 'grab_pay'],
        },
      },
    });
  }

  async attachPaymentMethod(paymentIntentId: string, paymentMethodId: string) {
    return this.makeRequest(
      'POST',
      `/payment_intents/${paymentIntentId}/attach`,
      {
        data: {
          attributes: {
            payment_method: paymentMethodId,
          },
        },
      },
    );
  }

  async createCheckoutSession(data: {
    amount: number;
    currency: string;
    description: string;
    metadata: Record<string, any>;
    successUrl?: string;
    cancelUrl?: string;
  }) {
    return this.makeRequest('POST', '/checkout_sessions', {
      data: {
        attributes: {
          line_items: [
            {
              name: data.description,
              amount: Math.round(data.amount * 100),
              currency: data.currency,
              quantity: 1,
            },
          ],
          payment_method_types: ['card', 'gcash', 'paymaya', 'grab_pay'],
          description: data.description,
          statement_descriptor: 'ChatMoo',
          metadata: data.metadata,
          success_url: data.successUrl,
          cancel_url: data.cancelUrl,
        },
      },
    });
  }

  async getPaymentIntent(paymentIntentId: string) {
    return this.makeRequest('GET', `/payment_intents/${paymentIntentId}`);
  }

  async createPaymentLink(data: {
    amount: number;
    currency: string;
    description: string;
    remarks: string;
  }) {
    return this.makeRequest('POST', '/links', {
      data: {
        attributes: {
          amount: Math.round(data.amount * 100),
          currency: data.currency,
          description: data.description,
          remarks: data.remarks,
          payment_method_allowed: ['card', 'gcash', 'paymaya', 'grab_pay'],
        },
      },
    });
  }

  async getPaymentLink(linkId: string) {
    return this.makeRequest('GET', `/links/${linkId}`);
  }

  async webhookIsValid(signature: string, body: string): Promise<boolean> {
    if (!this.webhookSecret) {
      console.error('[PaymongoService] Webhook secret key not configured');
      return false;
    }

    const hash = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body)
      .digest('base64');

    return hash === signature;
  }

  private async creditWallet(
    amountMinor: number,
    userId: string,
    purpose: string,
    providerRef: string,
  ) {
    if (!amountMinor || !userId) {
      throw new Error('Missing required fields: amount or userId');
    }

    try {
      const result = await (this.prisma as any).$transaction(async (t: any) => {
        // Idempotency guard: never double-credit the same payment
        const existing = await t.walletTransaction.findFirst({
          where: { providerRef, type: 'deposit', provider: 'paymongo' },
        });
        if (existing) {
          console.log('[PaymongoService] Duplicate webhook, skipping:', providerRef);
          return existing;
        }

        // Ensure wallet exists
        const wallet = await t.wallet.upsert({
          where: { userId },
          create: { userId, balance: 0, currency: 'PHP', status: 'active' },
          update: {},
        });

        if (wallet.status !== 'active') {
          throw new Error('Wallet is frozen');
        }

        // Create completed transaction record
        const tx = await t.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId,
            type: 'deposit',
            amount: amountMinor,
            fee: 0,
            status: 'completed',
            provider: 'paymongo',
            method: 'paymongo',
            providerRef,
            remarks: `PayMongo payment for ${purpose}`,
          },
        });

        // Credit the wallet
        await t.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amountMinor } },
        });

        return tx;
      });

      console.log('[PaymongoService] Payment processed:', providerRef, 'user:', userId, 'amount:', amountMinor);
      emitWalletUpdated(userId);
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[PaymongoService] Failed to process payment:', errorMessage);
      throw new Error(`Failed to process payment: ${errorMessage}`);
    }
  }

  async handlePaymentSucceeded(event: any) {
    const paymentIntentId = event?.id;
    const amount = event?.attributes?.amount;
    const metadata = event?.attributes?.metadata || {};
    const userId = metadata.userId;

    if (!paymentIntentId || !amount || !userId) {
      console.warn('[PaymongoService] Skipping payment intent', paymentIntentId, '- unresolvable: missing id, amount, or userId metadata');
      return { skipped: true, reason: 'missing_ref', id: paymentIntentId };
    }

    const purpose = metadata.purpose || 'wallet';
    return this.creditWallet(amount, userId, purpose, paymentIntentId);
  }

  async handlePaymentPaid(event: any) {
    const paymentId = event?.id;
    const amount = event?.attributes?.amount;
    const metadata = event?.attributes?.metadata || {};
    let userId = metadata.userId;

    if (!paymentId || !amount) {
      console.warn('[PaymongoService] Skipping payment', paymentId, '- unresolvable: missing id or amount');
      return { skipped: true, reason: 'missing_ref', id: paymentId };
    }

    // Fallback: if the payment carried no userId (e.g. legacy payment links),
    // match the wallet owner by the billing email on the payment.
    if (!userId) {
      const email = event?.attributes?.billing?.email;
      if (email) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (user) {
          userId = user.id;
          console.log('[PaymongoService] Resolved payment', paymentId, 'to user by email:', email);
        }
      }
    }

    if (!userId) {
      console.warn('[PaymongoService] Skipping payment', paymentId, '- no userId metadata and billing email does not match any user');
      return { skipped: true, reason: 'no_user_reference', id: paymentId };
    }

    const purpose = metadata.purpose || 'wallet';
    return this.creditWallet(amount, userId, purpose, paymentId);
  }

  async handleCheckoutSessionPaid(event: any) {
    const attributes = event?.attributes || {};
    const sessionId = event?.id;
    const metadata = attributes.metadata || {};
    const userId = metadata.userId;
    const payments = attributes.payments || [];
    const amount =
      payments.reduce((sum: number, p: any) => sum + (p?.attributes?.amount || 0), 0) ||
      attributes.payment_intent?.attributes?.amount ||
      0;

    if (!sessionId || !amount) {
      console.warn('[PaymongoService] Skipping checkout session', sessionId, '- unresolvable: missing id or amount');
      return { skipped: true, reason: 'missing_ref', id: sessionId };
    }

    if (!userId) {
      console.warn('[PaymongoService] Skipping checkout session', sessionId, '- no userId in metadata');
      return { skipped: true, reason: 'no_user_reference', id: sessionId };
    }

    const purpose = metadata.purpose || 'wallet';
    return this.creditWallet(amount, userId, purpose, sessionId);
  }
}
