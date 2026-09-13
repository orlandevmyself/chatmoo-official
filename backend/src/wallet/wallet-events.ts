import { EventEmitter } from 'events';

// Tiny process-global event bus so WalletService can announce balance changes
// and the ChatGateway can fan them out to the user's live sockets as
// `walletUpdated` events (used by the dashboard balance preview).
export type WalletUpdatedPayload = { userId: string };

export const walletEvents = new EventEmitter();

export const WALLET_EVENTS = {
  updated: 'wallet.updated',
} as const;

export function emitWalletUpdated(userId: string) {
  walletEvents.emit(WALLET_EVENTS.updated, { userId } satisfies WalletUpdatedPayload);
}