import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { generateKeysBodySchema, verifyBodySchema, redeemBodySchema, planEnum } from '../lib/schema.js';
import { insertKeysSecure, prepareSecureRecords, verifyKeySecure, markRedeemedByLookup } from '../lib/db.js';

const router = Router();

const apiToken = process.env.API_TOKEN || '';

function requireAuth(req, res, next) {
	const token = req.header('x-api-token');
	if (!apiToken || token !== apiToken) {
		return res.status(401).json({ error: 'unauthorized' });
	}
	next();
}

const verifyLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });
const redeemLimiter = rateLimit({ windowMs: 60_000, max: 5, standardHeaders: true, legacyHeaders: false });

function randChunk(length = 6) {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let out = '';
	for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
	return out;
}

function makeKey(plan) {
	return `WONDER-${plan}-${randChunk()}-${randChunk()}`;
}

router.post('/keys/generate', requireAuth, async (req, res) => {
	const parsed = generateKeysBodySchema.safeParse(req.body);
	if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
	const { plan, count } = parsed.data;
	const keys = Array.from({ length: count }, () => makeKey(plan));
	const secureRecords = await prepareSecureRecords(plan, keys);
	await insertKeysSecure(secureRecords);
	// Return plaintext keys once (never stored plaintext)
	return res.json({ keys });
});

router.post('/keys/verify', verifyLimiter, async (req, res) => {
	const parsed = verifyBodySchema.safeParse(req.body);
	if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
	const result = await verifyKeySecure(parsed.data.key);
	if (!result.ok) return res.json({ valid: false, reason: result.reason });
	return res.json({ valid: true, plan: result.plan });
});

router.post('/keys/redeem', redeemLimiter, async (req, res) => {
	const parsed = redeemBodySchema.safeParse(req.body);
	if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
	const result = await verifyKeySecure(parsed.data.key);
	if (!result.ok) return res.json({ success: false, reason: result.reason });
	const update = markRedeemedByLookup(result.lookupId, parsed.data.userId);
	if (update.changes === 1) return res.json({ success: true, plan: result.plan });
	return res.json({ success: false, reason: 'conflict' });
});

// Download endpoint for the website
router.post('/download', async (req, res) => {
	const auth = req.headers.auth;
	if (!auth) return res.status(400).json({ message: 'Key não fornecida' });
	
	const result = await verifyKeySecure(auth);
	if (!result.ok) {
		return res.status(401).json({ message: 'Key inválida ou já utilizada' });
	}
	
	// Mark as redeemed
	const update = markRedeemedByLookup(result.lookupId, 'web-download');
	if (update.changes === 0) {
		return res.status(409).json({ message: 'Key já foi utilizada' });
	}
	
	// Return the executable file (you'll need to place Wonder.exe in public folder)
	const filePath = path.join(__dirname, '../public/Wonder.exe');
	if (!fs.existsSync(filePath)) {
		return res.status(404).json({ message: 'Arquivo não encontrado' });
	}
	
	res.download(filePath, 'Wonder.exe');
});

// Check endpoint for key validation
router.post('/check', async (req, res) => {
	const { key } = req.body;
	if (!key) return res.status(400).json({ valid: false, message: 'Key não fornecida' });
	
	const result = await verifyKeySecure(key);
	if (!result.ok) {
		return res.json({ valid: false, message: 'Key inválida' });
	}
	
	return res.json({ valid: true, plan: result.plan });
});

export default router;
