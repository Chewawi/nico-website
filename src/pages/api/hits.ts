import type { APIRoute } from 'astro';
import { db, json } from '../../lib/guestbook';

export const prerender = false;

export const GET: APIRoute = async () => {
	const row = await db().prepare("SELECT value FROM counters WHERE key = 'visits'").first<{ value: number }>();
	return json({ count: row?.value ?? 0 });
};

export const POST: APIRoute = async () => {
	const row = await db()
		.prepare("UPDATE counters SET value = value + 1 WHERE key = 'visits' RETURNING value")
		.first<{ value: number }>();
	return json({ count: row?.value ?? 0 });
};
