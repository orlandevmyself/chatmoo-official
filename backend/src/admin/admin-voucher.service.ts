import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';
import { randomInt } from 'crypto';

const VOUCHER_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // exclude 0, 1, I, O, L
const VOUCHER_CODE_LENGTH = 8; // XXXX-XXXX format
const CODE_GENERATION_RETRIES = 5;

function generateVoucherCode(): string {
  const chars: string[] = [];
  for (let i = 0; i < VOUCHER_CODE_LENGTH; i++) {
    chars.push(VOUCHER_CODE_ALPHABET[randomInt(0, VOUCHER_CODE_ALPHABET.length)]);
  }
  // Format as XXXX-XXXX
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

@Injectable()
export class AdminVoucherService {
  constructor(
    private prisma: PrismaService,
    private adminService: AdminService,
  ) {}

  async createVoucher(adminUserId: string, dto: {
    bonusType: 'percentage' | 'fixed';
    bonusAmount: number;
    maxBonusMinor?: number;
    maxUses: number;
    validUntil?: Date;
    description?: string;
    code?: string; // optional custom code override
  }) {
    await this.adminService.assertAdmin(adminUserId);

    // Validate input
    if (!['percentage', 'fixed'].includes(dto.bonusType)) {
      throw new BadRequestException('bonusType must be "percentage" or "fixed"');
    }
    if (!Number.isInteger(dto.bonusAmount) || dto.bonusAmount <= 0) {
      throw new BadRequestException('bonusAmount must be a positive integer');
    }
    if (!Number.isInteger(dto.maxUses) || dto.maxUses < 1) {
      throw new BadRequestException('maxUses must be >= 1');
    }
    if (dto.validUntil && new Date(dto.validUntil) <= new Date()) {
      throw new BadRequestException('validUntil must be a future date');
    }
    if (dto.maxBonusMinor !== undefined && dto.maxBonusMinor <= 0) {
      throw new BadRequestException('maxBonusMinor must be positive');
    }

    const code = dto.code || generateVoucherCode();

    // Retry code generation on unique constraint violation
    for (let attempt = 0; attempt < CODE_GENERATION_RETRIES; attempt++) {
      try {
        const voucher = await (this.prisma as any).voucher.create({
          data: {
            code,
            bonusType: dto.bonusType,
            bonusAmount: dto.bonusAmount,
            maxBonusMinor: dto.maxBonusMinor || null,
            maxUses: dto.maxUses,
            validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
            description: dto.description || null,
            active: true,
            createdBy: adminUserId,
          },
        });
        return this.formatVoucher(voucher);
      } catch (e: any) {
        if (e?.code === 'P2002' && e?.meta?.target?.includes('code')) {
          if (attempt < CODE_GENERATION_RETRIES - 1) {
            // Retry with a new code (only if auto-generated, not custom)
            if (!dto.code) {
              continue;
            }
          }
          throw new BadRequestException('Code already exists');
        }
        throw e;
      }
    }
    throw new BadRequestException('Failed to generate unique code after retries');
  }

  async listVouchers(adminUserId: string, query: {
    page?: number;
    limit?: number;
    active?: boolean;
    search?: string;
  }) {
    await this.adminService.assertAdmin(adminUserId);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const where: any = {};

    if (query.active !== undefined) {
      where.active = query.active;
    }
    if (query.search) {
      where.code = { contains: query.search.toUpperCase(), mode: 'insensitive' };
    }

    const [total, vouchers] = await Promise.all([
      (this.prisma as any).voucher.count({ where }),
      (this.prisma as any).voucher.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      items: vouchers.map((v: any) => this.formatVoucher(v)),
    };
  }

  async getVoucherDetail(adminUserId: string, voucherId: string) {
    await this.adminService.assertAdmin(adminUserId);
    const voucher = await (this.prisma as any).voucher.findUnique({
      where: { id: voucherId },
      include: {
        usages: {
          include: {
            user: {
              select: { id: true, name: true, username: true, email: true },
            },
          },
          orderBy: { usedAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!voucher) {
      throw new BadRequestException('Voucher not found');
    }

    return {
      ...this.formatVoucher(voucher),
      usages: voucher.usages.map((usage: any) => ({
        id: usage.id,
        user: usage.user,
        bonusAmount: usage.bonusAmount,
        usedAt: usage.usedAt,
      })),
    };
  }

  async updateVoucher(adminUserId: string, voucherId: string, dto: {
    description?: string;
    maxUses?: number;
    validUntil?: Date;
    active?: boolean;
  }) {
    await this.adminService.assertAdmin(adminUserId);
    const voucher = await (this.prisma as any).voucher.findUnique({
      where: { id: voucherId },
    });

    if (!voucher) {
      throw new BadRequestException('Voucher not found');
    }


    // Validate maxUses
    if (dto.maxUses !== undefined && dto.maxUses < voucher.currentUses) {
      throw new BadRequestException(
        `maxUses cannot be less than current uses (${voucher.currentUses})`,
      );
    }

    const updateData: any = {};
    if (dto.description !== undefined) updateData.description = dto.description || null;
    if (dto.maxUses !== undefined) updateData.maxUses = dto.maxUses;
    if (dto.validUntil !== undefined) updateData.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (dto.active !== undefined) updateData.active = dto.active;

    const updated = await (this.prisma as any).voucher.update({
      where: { id: voucherId },
      data: updateData,
    });

    return this.formatVoucher(updated);
  }

  private formatVoucher(voucher: any) {
    const now = new Date();
    let status = 'Active';
    if (!voucher.active) {
      status = 'Inactive';
    } else if (voucher.validUntil && voucher.validUntil < now) {
      status = 'Expired';
    }

    return {
      id: voucher.id,
      code: voucher.code,
      bonusType: voucher.bonusType,
      bonusAmount: voucher.bonusAmount,
      maxBonusMinor: voucher.maxBonusMinor,
      maxUses: voucher.maxUses,
      currentUses: voucher.currentUses,
      validFrom: voucher.validFrom,
      validUntil: voucher.validUntil,
      active: voucher.active,
      status,
      description: voucher.description,
      createdBy: voucher.createdBy,
      createdAt: voucher.createdAt,
      updatedAt: voucher.updatedAt,
    };
  }
}
