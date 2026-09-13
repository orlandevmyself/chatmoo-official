import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Platform configuration, editable from the admin panel via the AppConfig table.
// Each key falls back to <env override> then <default>, so removing a row (or
// an unreachable DB) simply reverts to the built-in value.
export interface KnownConfig {
  withdrawablePercent: number; // whole number 1..100
  minDepositMinor: number;
  minWithdrawMinor: number;
  maxTxMinor: number;
}

const DEFAULT_CONFIG: KnownConfig = {
  withdrawablePercent: 80,
  minDepositMinor: 2000, // ₱20
  minWithdrawMinor: 5000, // ₱50
  maxTxMinor: 5000000, // ₱50,000
};

const NUMERIC_KEY_HINTS: Record<string, { min: number; max: number }> = {
  withdrawablePercent: { min: 1, max: 100 },
  minDepositMinor: { min: 1, max: 100000000 },
  minWithdrawMinor: { min: 1, max: 100000000 },
  maxTxMinor: { min: 1000, max: 100000000 },
};

@Injectable()
export class AppConfigService {
  constructor(private prisma: PrismaService) {}

  private envSource(key: string): number | undefined {
    const map: Record<string, string> = {
      withdrawablePercent: 'WITHDRAWABLE_PERCENT',
      minDepositMinor: 'MIN_DEPOSIT_MINOR',
      minWithdrawMinor: 'MIN_WITHDRAW_MINOR',
      maxTxMinor: 'MAX_TX_MINOR',
    };
    const envKey = map[key];
    if (!envKey) return undefined;
    const raw = Number(process.env[envKey]);
    return Number.isFinite(raw) ? raw : undefined;
  }

  // DB override (or env/fallback if the table is unreachable/empty).
  private async getNumber(key: keyof KnownConfig): Promise<number> {
    const fallback = DEFAULT_CONFIG[key];
    const env = this.envSource(key);
    try {
      const row = await (this.prisma as any).appConfig.findUnique({ where: { key } });
      const raw = row ? Number(row.value) : undefined;
      if (Number.isFinite(raw)) {
        const hint = NUMERIC_KEY_HINTS[key];
        return Math.min(hint.max, Math.max(hint.min, Math.round(raw as number)));
      }
    } catch {
      // DB down — fall through to env/default.
    }
    if (Number.isFinite(env)) {
      const hint = NUMERIC_KEY_HINTS[key];
      return Math.min(hint.max, Math.max(hint.min, Math.round(env as number)));
    }
    return fallback;
  }

  async withdrawablePercent(): Promise<number> {
    return this.getNumber('withdrawablePercent');
  }

  async minDepositMinor(): Promise<number> {
    return this.getNumber('minDepositMinor');
  }

  async minWithdrawMinor(): Promise<number> {
    return this.getNumber('minWithdrawMinor');
  }

  async maxTxMinor(): Promise<number> {
    return this.getNumber('maxTxMinor');
  }

  // All known keys with effective values (admin read view).
  async getEffectiveConfig(): Promise<KnownConfig> {
    const [withdrawablePercent, minDepositMinor, minWithdrawMinor, maxTxMinor] =
      await Promise.all([
        this.withdrawablePercent(),
        this.minDepositMinor(),
        this.minWithdrawMinor(),
        this.maxTxMinor(),
      ]);
    return { withdrawablePercent, minDepositMinor, minWithdrawMinor, maxTxMinor };
  }

  // Bulk upsert with validation. `patch` is a partial { key: newValue }.
  async updateConfig(patch: Record<string, unknown>): Promise<KnownConfig> {
    for (const [key, rawValue] of Object.entries(patch || {})) {
      if (!(key in DEFAULT_CONFIG)) {
        throw new BadRequestException(`Unknown config key: ${key}`);
      }
      const num = Number(rawValue);
      if (!Number.isFinite(num) || !Number.isInteger(num)) {
        throw new BadRequestException(`Config "${key}" must be an integer`);
      }
      const hint = NUMERIC_KEY_HINTS[key as keyof KnownConfig];
      if (num < hint.min || num > hint.max) {
        throw new BadRequestException(`Config "${key}" must be between ${hint.min} and ${hint.max}`);
      }
      await (this.prisma as any).appConfig.upsert({
        where: { key },
        create: { key, value: String(num) },
        update: { value: String(num) },
      });
    }
    return this.getEffectiveConfig();
  }

  // Delete an override (revert to env/default).
  async clearOverride(key: string) {
    if (!(key in DEFAULT_CONFIG)) {
      throw new BadRequestException(`Unknown config key: ${key}`);
    }
    try {
      await (this.prisma as any).appConfig.delete({ where: { key } });
    } catch {
      // already gone — fine
    }
    return this.getEffectiveConfig();
  }
}
