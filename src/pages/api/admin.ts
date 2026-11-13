import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import { isAdmin, unauthorized } from '../../lib/guestbook';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
	if (!isAdmin(request)) return unauthorized();
	// Browsers resend saved Basic credentials on cross-site posts, so check where this came from.
	if (request.headers.get('origin') !== new URL(request.url).origin) return new Response('Forbidden', { status: 403 });

	const form = await request.formData();
	const id = String(form.get('id') ?? '');
	const action = form.get('action');
	if (action === 'approve') await query("UPDATE drawings SET status = 'approved' WHERE id = ?", id);
	else if (action === 'hide') await query("UPDATE drawings SET status = 'pending' WHERE id = ?", id);
	else if (action === 'delete') await query('DELETE FROM drawings WHERE id = ?', id);
	else return new Response('Unknown action', { status: 400 });

	return redirect('/admin/', 303);
};
