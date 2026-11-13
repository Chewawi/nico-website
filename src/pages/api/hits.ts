import type { APIRoute } from 'astro';
import { first } from '../../lib/db';
import { json } from '../../lib/guestbook';

export const prerender = false;

export const GET: APIRoute = async () => {
	const row = await first<{ value: number }>("SELECT value FROM counters WHERE key = 'visits'");
	return json({ count: row?.value ?? 0 });
};

export const POST: APIRoute = async () => {
	const row = await first<{ value: number }>("UPDATE counters SET value = value + 1 WHERE key = 'visits' RETURNING value");
	return json({ count: row?.value ?? 0 });
};
