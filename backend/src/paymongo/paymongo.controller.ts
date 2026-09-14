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
    try {
      const rawBody =
        req.rawBody && Buffer.isBuffer(req.rawBody)
          ? req.rawBody.toString('utf8')
          : JSON.stringify(req.body);

      const isValid = await this.paymongoService.webhookIsValid(signature, rawBody);

      if (!isValid) {
        return {
          success: false,
          error: 'Invalid webhook signature',
        };
      }

      const payload = JSON.parse(rawBody);
      const event = payload.data;
      console.log('PayMongo Webhook Event:', event.type, event.id);

      // Handle different webhook event types
      switch (event.type) {
        case 'payment_intent.amount_capturable_updated':
          // Payment method attached, ready to capture
          console.log('Payment method attached:', event.attributes.id);
          break;
        case 'payment_intent.succeeded':
          // Payment successful - credit user's wallet
          console.log('Payment succeeded:', event.attributes.id);
          await this.paymongoService.handlePaymentSucceeded(event);
          break;
        case 'checkout_session.payment.paid':
          // Hosted checkout paid - credit user's wallet
          console.log('Checkout session paid:', event.attributes.id);
          await this.paymongoService.handleCheckoutSessionPaid(event);
          break;
        case 'payment_intent.canceled':
          // Payment canceled
          console.log('Payment canceled:', event.attributes.id);
          break;
        default:
          console.log('Unhandled event type:', event.type);
      }

      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Webhook Error:', errorMessage);
      throw new BadRequestException(errorMessage);
    }
  }
}
