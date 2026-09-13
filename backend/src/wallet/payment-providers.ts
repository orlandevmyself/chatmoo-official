// Payment provider seam.
//
// LEGAL SAFETY: the app runs on the "demo" provider by default, which moves
// no real money and calls no external API. A real-money provider (PayMongo,
// Xendit, Maya, Dragonpay, banks) may only be plugged in here once the
// business holds the required licenses (in PH: BSP EMI / e-money authority).
// Until then, setting PAYMENTS_PROVIDER to anything but "demo" fails loudly
// instead of silently touching real rails.

export type WalletTxType = 'deposit' | 'withdraw';

export interface ProviderQuote {
  feeMinor: number;
  etaSeconds: number;
}

export interface PaymentProvider {
  readonly name: string;
  quote(type: WalletTxType, amountMinor: number, method?: string): ProviderQuote;
  // Called AFTER the pending ledger row exists. Must be safe to retry:
  // implementations must treat an already-handled tx as a no-op.
  initiateDeposit(txId: string, userId: string, amountMinor: number, method?: string): Promise<{ providerRef?: string }>;
  initiateWithdraw(txId: string, userId: string, amountMinor: number, method?: string, destination?: string): Promise<{ providerRef?: string }>;
}

// Demo provider: simulates settlement with a short delay. No network calls.
export class DemoPaymentProvider implements PaymentProvider {
  readonly name = 'demo';

  quote(type: WalletTxType): ProviderQuote {
    return { feeMinor: 0, etaSeconds: type === 'deposit' ? 2 : 5 };
  }

  async initiateDeposit(): Promise<{ providerRef?: string }> {
    return { providerRef: `demo-dep-${Date.now()}` };
  }

  async initiateWithdraw(): Promise<{ providerRef?: string }> {
    return { providerRef: `demo-wd-${Date.now()}` };
  }
}

// Future real-money adapter (NOT active until licensed + keys configured):
//
//   export class PayMongoProvider implements PaymentProvider {
//     readonly name = 'paymongo';
//     // Deposits: create a PayMongo Checkout Session / Payment Intent
//     //   (GCash, GrabPay, Maya, cards) and confirm via webhook.
//     // Withdrawals: PayMongo has no general payouts rail — pair it with a
//     //   disbursement provider (Xendit Disbursements, Maya Business,
//     //   Dragonpay, or a bank API) behind this same interface.
//     // Required env: PAYMONGO_SECRET_KEY (+ webhook secret). Without them,
//     //   the constructor must throw — never fall back to moving money.
//   }

export function getPaymentProvider(): PaymentProvider {
  const name = (process.env.PAYMENTS_PROVIDER || 'demo').toLowerCase();
  if (name === 'demo') {
    return new DemoPaymentProvider();
  }
  throw new Error(
    `Payment provider "${name}" is not configured. ` +
    `Set PAYMENTS_PROVIDER=demo until real-money rails are licensed and integrated.`,
  );
}
