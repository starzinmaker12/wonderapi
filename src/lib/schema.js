import { z } from 'zod';

export const planEnum = z.enum(['BASICO', 'PREMIUM', 'VIP']);

export const keyRecordSchema = z.object({
	key: z.string(),
	plan: planEnum,
	status: z.enum(['unused', 'redeemed', 'revoked']).default('unused'),
	createdAt: z.date(),
	redeemedAt: z.date().nullable().optional(),
	redeemedBy: z.string().nullable().optional()
});

export const generateKeysBodySchema = z.object({
	plan: planEnum,
	count: z.number().int().min(1).max(100).default(1)
});

export const verifyBodySchema = z.object({
	key: z.string().min(8)
});

export const redeemBodySchema = z.object({
	key: z.string().min(8),
	userId: z.string().min(3)
});
