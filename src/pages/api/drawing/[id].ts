import type { APIRoute } from 'astro';
import { first } from '../../../lib/db';
import { isAdmin } from '../../../lib/guestbook';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
	const row = await first<{ status: string; image: ArrayBuffer | Uint8Array }>(
		'SELECT status, image FROM drawings WHERE id = ?',
		params.id ?? '',
	);

	const approved = row?.status === 'approved';
	if (!row || (!approved && !isAdmin(request))) return new Response('Not found', { status: 404 });

	return new Response(new Uint8Array(row.image), {
		headers: {
			'content-type': 'image/png',
			// An approved drawing never changes; pending ones are only for the admin page.
			'cache-control': approved ? 'public, max-age=31536000, immutable' : 'private, no-store',
			'x-content-type-options': 'nosniff',
		},
	});
};
