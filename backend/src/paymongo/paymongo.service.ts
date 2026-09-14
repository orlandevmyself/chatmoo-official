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

  async handlePaymentSucceeded(event: any) {
    const paymentIntentId = event.attributes?.id;
    const amount = event.attributes?.amount;
    const metadata = event.attributes?.metadata || {};
    const userId = metadata.userId;

    if (!paymentIntentId || !amount || !userId) {
      throw new Error('Missing required fields in payment intent: id, amount, or userId in metadata');
    }

    // Create wallet transaction and credit the wallet atomically
    const amountMinor = amount; // PayMongo returns amount already in cents
    const purpose = metadata.purpose || 'wallet';

    try {
      const result = await (this.prisma as any).$transaction(async (t: any) => {
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
            providerRef: paymentIntentId,
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

      console.log('[PaymongoService] Payment processed:', paymentIntentId, 'user:', userId, 'amount:', amountMinor);
      emitWalletUpdated(userId);
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[PaymongoService] Failed to process payment:', errorMessage);
      throw new Error(`Failed to process payment: ${errorMessage}`);
    }
  }
}
