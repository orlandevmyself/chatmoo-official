# PayMongo Integration Guide

## Overview
This project is integrated with PayMongo for payment processing. PayMongo is a payment platform that supports multiple payment methods for Philippines-based transactions.

## API Keys

### Environment Setup
Keys are configured in:
- **Backend**: `backend/.env`
- **Frontend**: `frontend/.env`

### Current Configuration (TEST MODE)
```
PAYMONGO_SECRET_KEY=sk_test_<your-test-secret-key>
PAYMONGO_PUBLIC_KEY=pk_test_<your-test-public-key>
```

### Live Keys (for production)
```
PAYMONGO_SECRET_KEY=sk_live_<your-live-secret-key>
PAYMONGO_PUBLIC_KEY=pk_live_<your-live-public-key>
```

**To switch to Live:**
1. Uncomment the LIVE keys in `backend/.env`
2. Comment out the TEST keys
3. Update `frontend/.env` with live public key
4. Restart the servers

## Backend Implementation

### Files Created
- `src/paymongo/paymongo.service.ts` - Payment service with PayMongo API calls
- `src/paymongo/paymongo.controller.ts` - REST endpoints for payment operations
- `src/paymongo/paymongo.module.ts` - NestJS module configuration

### Available Endpoints

#### 1. Create Payment Intent
```bash
POST /paymongo/payment-intent
Content-Type: application/json

{
  "amount": 100,          # Amount in PHP (will be converted to cents)
  "currency": "PHP",
  "description": "Wallet Top-up",
  "metadata": {
    "userId": "user-123",
    "purpose": "wallet"
  }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "pi_xxx",
    "attributes": {
      "amount": 10000,
      "currency": "PHP",
      "status": "awaiting_payment_method",
      "description": "Wallet Top-up",
      "metadata": { ... }
    }
  }
}
```

#### 2. Attach Payment Method
```bash
POST /paymongo/payment-intent/:id/attach
Content-Type: application/json

{
  "paymentMethodId": "pm_xxx"
}
```

#### 3. Get Payment Intent Status
```bash
GET /paymongo/payment-intent/:id
```

#### 4. Create Payment Link (Recommended for Frontend)
```bash
POST /paymongo/payment-link
Content-Type: application/json

{
  "amount": 100,
  "currency": "PHP",
  "description": "Wallet Top-up",
  "remarks": "User wallet top-up"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "link_xxx",
    "attributes": {
      "amount": 10000,
      "currency": "PHP",
      "checkout_url": "https://checkout.paymongo.com/...",
      "status": "open",
      "description": "Wallet Top-up",
      "created_at": "2024-09-14T..."
    }
  }
}
```

#### 5. Get Payment Link Status
```bash
GET /paymongo/payment-link/:id
```

#### 6. Webhook Handler
```bash
POST /paymongo/webhook
x-paymongo-signature: <signature>

{
  "data": {
    "id": "evt_xxx",
    "type": "payment_intent.succeeded",
    "attributes": { ... }
  }
}
```

**Supported Webhook Events:**
- `payment_intent.amount_capturable_updated` - Payment method attached
- `payment_intent.succeeded` - Payment successful
- `payment_intent.canceled` - Payment canceled
- `payment_intent.payment_failed` - Payment failed

## Frontend Implementation

### Files Created
- `src/utils/paymongoApi.js` - API client for payment operations
- `src/components/PaymentModal.js` - Payment UI component

### Usage Example

```jsx
import { useState } from 'react';
import PaymentModal from './components/PaymentModal';

function WalletTopup() {
  const [showPayment, setShowPayment] = useState(false);

  return (
    <>
      <button onClick={() => setShowPayment(true)}>
        Top-up Wallet
      </button>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        purpose="wallet"  // or "gift", "premium"
        onSuccess={(data) => {
          console.log('Payment successful:', data);
          // Update wallet balance, etc.
        }}
      />
    </>
  );
}
```

## Payment Flow

### Simple Flow (Recommended - Payment Links)
1. User clicks "Top-up" / "Buy Gift" / etc.
2. PaymentModal opens
3. User enters amount and email
4. Frontend calls `createPaymentLink()`
5. User redirected to PayMongo checkout
6. PayMongo handles payment and redirects back
7. Webhook notifies backend of payment status
8. Backend updates wallet/gift count

### Complex Flow (Payment Intents)
1. Create Payment Intent
2. Frontend renders payment method form
3. User enters card/payment details
4. Frontend creates payment method with PayMongo SDK
5. Attach payment method to intent
6. Capture payment
7. Webhook confirms success

## Testing Payments

### Test Card Numbers
```
Visa:
- Number: 4242 4242 4242 4242
- Exp: 12/25
- CVC: 123

Mastercard:
- Number: 5555 5555 5555 4444
- Exp: 12/25
- CVC: 123
```

### Test Amounts
- Any amount works in test mode
- Recommended: ₱100, ₱500, ₱1000

## Security Notes

1. **Secret Key Protection**
   - Never expose secret key in frontend code
   - Keep secret key in backend environment variables only
   - Never commit .env files with real keys

2. **Webhook Signature Verification**
   - Always verify webhook signatures
   - Prevents unauthorized/spoofed webhooks

3. **HTTPS in Production**
   - Ensure HTTPS for all payment URLs
   - PayMongo enforces HTTPS for webhook callbacks

4. **Data Validation**
   - Validate all amounts server-side
   - Verify user ownership of wallet/account
   - Implement rate limiting on payment endpoints

## Error Handling

Common errors and their meanings:

```
"Invalid webhook signature" - Webhook verification failed
"Payment method already exists" - Duplicate payment method
"Amount must be greater than 0" - Invalid amount
"Invalid currency" - Only PHP supported currently
"Payment intent not found" - ID doesn't exist or expired
```

## Webhook Handler Implementation

### What Happens on `payment_intent.succeeded`

When PayMongo sends a webhook for a successful payment:

1. **Signature Verification**: Backend verifies the webhook signature using HMAC-SHA256
2. **Transaction Creation**: Creates a completed `WalletTransaction` record with:
   - Type: `deposit`
   - Status: `completed`
   - Provider: `paymongo`
   - Amount: From payment intent (already in cents)
3. **Wallet Credit**: Atomically increments the user's wallet balance
4. **Event Emission**: Emits a wallet update event to notify real-time listeners

### Required Metadata

When creating a payment intent, include this metadata:

```json
{
  "userId": "user-id-string",
  "purpose": "wallet|gift|premium"
}
```

The webhook handler uses `userId` to credit the correct wallet.

### Testing Webhooks Locally

For local testing without exposing your server to the internet:

1. Use [ngrok](https://ngrok.com/) to tunnel your local server:
   ```bash
   ngrok http 3001
   ```

2. Get your public URL and configure PayMongo webhooks at https://dashboard.paymongo.com/webhooks

3. Set webhook endpoint to: `https://your-ngrok-url.ngrok.io/paymongo/webhook`

4. Subscribe to these events:
   - `payment_intent.succeeded`
   - `payment_intent.canceled`
   - `payment_intent.payment_failed`

## Database Schema

Payments are tracked using the existing wallet system:

- **Wallet**: User's balance (in cents) - automatically updated by webhooks
- **WalletTransaction**: Records all deposit/withdrawal activity
  - Provider: `paymongo` for PayMongo payments
  - Status: `completed` when webhook is received
  - ProviderRef: PayMongo payment intent ID for reference

## Resources

- [PayMongo Documentation](https://developers.paymongo.com/)
- [Payment Intents Guide](https://developers.paymongo.com/docs/payment-intents)
- [Payment Links Guide](https://developers.paymongo.com/docs/payment-links)
- [Webhooks Guide](https://developers.paymongo.com/docs/webhooks)

## Support

For PayMongo support:
- Email: support@paymongo.com
- Website: https://paymongo.com
