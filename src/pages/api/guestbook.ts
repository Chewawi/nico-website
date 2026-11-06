import type { APIRoute } from 'astro';
import { clean, db, isCanvasPng, json, LIMITS, verifyTurnstile } from '../../lib/guestbook';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	const form = await request.formData().catch(() => null);
	if (!form) return json({ error: 'That submission looked broken. Try again?' }, 400);

	// Honeypot: bots fill every field; pretend it worked.
	if (form.get('hp_extra')) return json({ ok: true }, 201);

	if (!(await verifyTurnstile(form.get('cf-turnstile-response'), request.headers.get('cf-connecting-ip')))) {
		return json({ error: "Couldn't check that you're a human. Reload the page and try again." }, 403);
	}

	const file = form.get('drawing');
	if (!(file instanceof File) || file.size > LIMITS.bytes) {
		return json({ error: 'That drawing is too big to send.' }, 413);
	}
	const image = new Uint8Array(await file.arrayBuffer());
	if (!isCanvasPng(image)) return json({ error: 'That drawing looked broken. Try again?' }, 400);

	const queue = await db().prepare("SELECT COUNT(*) AS n FROM drawings WHERE status = 'pending'").first<{ n: number }>();
	if ((queue?.n ?? 0) >= LIMITS.pending) {
		return json({ error: 'The guestbook is full of unread drawings right now. Come back in a few days!' }, 503);
	}

	await db()
		.prepare('INSERT INTO drawings (id, created_at, name, message, image) VALUES (?, ?, ?, ?, ?)')
		.bind(crypto.randomUUID(), Date.now(), clean(form.get('name'), LIMITS.name), clean(form.get('message'), LIMITS.message), image)
		.run();

	return json({ ok: true }, 201);
};
