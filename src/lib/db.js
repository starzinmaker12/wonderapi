import { logger } from './logger.js';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = 'src/data';
const dbPath = path.join(dataDir, 'db.json');

function ensureDataDir() {
	try { fs.mkdirSync(dataDir, { recursive: true }); } catch {}
}

function loadDb() {
	ensureDataDir();
	if (!fs.existsSync(dbPath)) {
		fs.writeFileSync(dbPath, JSON.stringify({ keys: [] }, null, 2));
	}
	try {
		const raw = fs.readFileSync(dbPath, 'utf8');
		const parsed = JSON.parse(raw);
		if (!parsed.keys) parsed.keys = [];
		return parsed;
	} catch (err) {
		logger.error({ err }, 'Failed to load db.json');
		return { keys: [] };
	}
}

function saveDb(db) {
	try {
		fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
	} catch (err) {
		logger.error({ err }, 'Failed to save db.json');
	}
}

function sha256Hex(input) {
	return crypto.createHash('sha256').update(input).digest('hex');
}

export async function insertKeysSecure(records) {
	// records: [{ plan, hash, lookupId, createdAt }]
	const db = loadDb();
	for (const row of records) {
		db.keys.push({
			id: crypto.randomUUID(),
			plan: row.plan,
			status: 'unused',
			createdAt: (row.createdAt || new Date()).toISOString(),
			redeemedAt: null,
			redeemedBy: null,
			hash: row.hash,
			lookupId: row.lookupId
		});
	}
	saveDb(db);
}

export function getRowByLookupId(lookupId) {
	const db = loadDb();
	return db.keys.find(k => k.lookupId === lookupId);
}

export function markRedeemedByLookup(lookupId, userId) {
	const db = loadDb();
	const row = db.keys.find(k => k.lookupId === lookupId && k.status === 'unused');
	if (!row) return { changes: 0 };
	row.status = 'redeemed';
	row.redeemedAt = new Date().toISOString();
	row.redeemedBy = userId;
	saveDb(db);
	return { changes: 1 };
}

export function revokeByLookup(lookupId) {
	const db = loadDb();
	const row = db.keys.find(k => k.lookupId === lookupId);
	if (!row) return { changes: 0 };
	row.status = 'revoked';
	saveDb(db);
	return { changes: 1 };
}

export async function prepareSecureRecords(plan, plainKeys) {
	const out = [];
	for (const k of plainKeys) {
		const hash = await argon2.hash(k, { type: argon2.argon2id });
		const lookupId = sha256Hex(k).slice(0, 32);
		out.push({ plan, hash, lookupId, createdAt: new Date() });
	}
	return out;
}

export async function verifyKeySecure(plainKey) {
	const lookupId = sha256Hex(plainKey).slice(0, 32);
	const row = getRowByLookupId(lookupId);
	if (!row) return { ok: false, reason: 'not_found' };
	if (row.status !== 'unused') return { ok: false, reason: row.status };
	const valid = await argon2.verify(row.hash, plainKey);
	if (!valid) return { ok: false, reason: 'invalid' };
	return { ok: true, plan: row.plan, lookupId };
}
