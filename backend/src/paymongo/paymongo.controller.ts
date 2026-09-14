import { Controller, Post, Get, Body, Param, Headers, Req, BadRequestException } from '@nestjs/common';
import { PaymongoService } from './paymongo.service';

@Controller('paymongo')
export class PaymongoController {
  constructor(private paymongoService: PaymongoService) {}

  @Post('payment-intent')
  async createPaymentIntent(
    @Body() body: {
      amount: number;
      currency: string;
      description: string;
      metadata: Record<string, any>;
    }
  ) {
    try {
      const paymentIntent = await this.paymongoService.createPaymentIntent(body);
      return {
        success: true,
        data: paymentIntent,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  @Post('payment-intent/:id/attach')
  async attachPaymentMethod(
    @Param('id') paymentIntentId: string,
    @Body() body: { paymentMethodId: string }
  ) {
    try {
      const result = await this.paymongoService.attachPaymentMethod(
        paymentIntentId,
        body.paymentMethodId
      );
      return {
        success: true,
        data: result,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  @Get('payment-intent/:id')
  async getPaymentIntent(@Param('id') paymentIntentId: string) {
    try {
      const paymentIntent = await this.paymongoService.getPaymentIntent(paymentIntentId);
      return {
        success: true,
        data: paymentIntent,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  @Post('payment-link')
  async createPaymentLink(
    @Body() body: {
      amount: number;
      currency: string;
      description: string;
      remarks: string;
    }
  ) {
    try {
      const link = await this.paymongoService.createPaymentLink(body);
      return {
        success: true,
        data: link,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  @Post('checkout-session')
  async createCheckoutSession(
    @Body() body: {
      amount: number;
      currency: string;
      description: string;
      metadata: Record<string, any>;
      successUrl?: string;
      cancelUrl?: string;
    }
  ) {
    try {
      const session = await this.paymongoService.createCheckoutSession(body);
      return {
        success: true,
        data: session,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  @Get('payment-link/:id')
  async getPaymentLink(@Param('id') linkId: string) {
    try {
      const link = await this.paymongoService.getPaymentLink(linkId);
      return {
        success: true,
        data: link,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  @Post('webhook')
  async handleWebhook(@Headers('x-paymongo-signature') signature: string, @Req() req: any) {
    const startedAt = new Date().toISOString();
    try {
      const rawBody =
        req.rawBody && Buffer.isBuffer(req.rawBody)
          ? req.rawBody.toString('utf8')
          : JSON.stringify(req.body);

      console.log(`[paymongo-webhook ${startedAt}] arrival: len=${rawBody.length} sig=${signature ? signature.slice(0, 12) + '...' : 'MISSING'} ip=${req.ip || req.socket?.remoteAddress}`);

      const isValid = await this.paymongoService.webhookIsValid(signature, rawBody);

      if (!isValid) {
        console.warn(`[paymongo-webhook ${startedAt}] REJECTED signature. Expected HMAC(secret): ${this.paymongoService.computeSignature(rawBody).slice(0, 12)}... Got: ${signature ? signature.slice(0, 12) + '...' : 'none'}`);
        console.warn(`[paymongo-webhook ${startedAt}] raw body: ${rawBody.slice(0, 300)}`);
        return {
          success: false,
          error: 'Invalid webhook signature',
        };
      }

      console.log(`[paymongo-webhook ${startedAt}] signature OK`);
      const payload = JSON.parse(rawBody);

      // Normalize the two known webhook envelope shapes PayMongo sends:
      //   classic     : { data: { id, type: 'event', attributes: { type, data } } }
      //   send.webhook: { event_type: 'send.webhook', data: { type: '<event>', ..., data: <resource> } }
      const top = payload?.data ?? {};
      let eventType =
        top.type === 'event' ? top?.attributes?.type
        : top.type && top.type !== 'event' && top.data ? top.type
        : payload?.event_type || null;
      let eventData =
        top.type === 'event' ? top?.attributes?.data
        : top.type && top.type !== 'event' && top.data ? top.data
        : top;

      const envelopeMode =
        top.type === 'event' && top?.attributes?.data ? 'classic'
        : top.type && top.type !== 'event' && top.data ? 'send.webhook'
        : top?.type ? 'flat'
        : 'unknown';

      console.log(`[paymongo-webhook ${startedAt}] envelope=${envelopeMode} eventType=${eventType} resource=${eventData?.type} resourceId=${eventData?.id} amount=${eventData?.attributes?.amount} metadata=${JSON.stringify(eventData?.attributes?.metadata || {}).slice(0, 200)} billingEmail=${eventData?.attributes?.billing?.email || eventData?.attributes?.customer_email || 'none'}`);

      // Handle different webhook event types
      switch (eventType) {
        case 'payment_intent.amount_capturable_updated':
          // Payment method attached, ready to capture
          console.log('Payment method attached:', eventData?.attributes?.id);
          break;
        case 'payment_intent.succeeded':
          // Payment successful - credit user's wallet
          await this.paymongoService.handlePaymentSucceeded(eventData);
          break;
        case 'payment.paid':
          // Simple payment (e.g. payment links) - credit by metadata userId or billing email
          await this.paymongoService.handlePaymentPaid(eventData);
          break;
        case 'checkout_session.payment.paid':
          // Hosted checkout paid - credit user's wallet
          await this.paymongoService.handleCheckoutSessionPaid(eventData);
          break;
        case 'payment_intent.canceled':
          // Payment canceled
          console.log('Payment canceled:', eventData?.attributes?.id);
          break;
        default:
          console.warn(`[paymongo-webhook ${startedAt}] UNHANDLED event type: ${eventType}`);
      }

      console.log(`[paymongo-webhook ${startedAt}] acked, event=${eventType} resourceId=${eventData?.id}`);
      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[paymongo-webhook ${startedAt}] Webhook Error: ${errorMessage}`);
      throw new BadRequestException(errorMessage);
    }
  }
}
