import type { APIRoute } from 'astro';
import { first, query } from '../../lib/db';
import { clean, isCanvasPng, json, LIMITS, verifyTurnstile } from '../../lib/guestbook';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
	const form = await request.formData().catch(() => null);
	if (!form) return json({ error: 'something broke. try again?' }, 400);

	// Honeypot: bots fill every field; pretend it worked.
	if (form.get('hp_extra')) return json({ ok: true }, 201);

	if (!(await verifyTurnstile(form.get('cf-turnstile-response'), clientAddress))) {
		return json({ error: "couldn't check you're not a robot. reload and try again" }, 403);
	}

	const file = form.get('drawing');
	if (!(file instanceof File) || file.size > LIMITS.bytes) {
		return json({ error: 'that drawing is too big' }, 413);
	}
	const image = new Uint8Array(await file.arrayBuffer());
	if (!isCanvasPng(image)) return json({ error: 'that drawing came out broken. try again?' }, 400);

	const queue = await first<{ n: number }>("SELECT COUNT(*) AS n FROM drawings WHERE status = 'pending'");
	if ((queue?.n ?? 0) >= LIMITS.pending) {
		return json({ error: "too many drawings waiting right now. try again in a few days" }, 503);
	}

	await query(
		'INSERT INTO drawings (id, created_at, name, message, image) VALUES (?, ?, ?, ?, ?)',
		crypto.randomUUID(),
		Date.now(),
		clean(form.get('name'), LIMITS.name),
		clean(form.get('message'), LIMITS.message),
		image,
	);

	return json({ ok: true }, 201);
};
