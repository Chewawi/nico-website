import { env } from 'cloudflare:workers';

export const CANVAS = { width: 480, height: 360 } as const;
export const LIMITS = { bytes: 200_000, name: 40, message: 200, pending: 200, perPage: 24 } as const;

export interface Entry {
	id: string;
	created_at: number;
	name: string;
	message: string;
	status: 'pending' | 'approved';
}

export const db = () => env.DB;

export const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
	});

export function clean(value: FormDataEntryValue | null, max: number) {
	return typeof value === 'string'
		? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max)
		: '';
}

// Accept only a PNG of exactly the canvas size; no decoding needed.
export function isCanvasPng(b: Uint8Array) {
	const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
	if (b.length < 33 || sig.some((v, i) => b[i] !== v)) return false;
	if (String.fromCharCode(...b.subarray(12, 16)) !== 'IHDR') return false;
	const view = new DataView(b.buffer, b.byteOffset);
	return view.getUint32(16) === CANVAS.width && view.getUint32(20) === CANVAS.height;
}

export async function verifyTurnstile(token: FormDataEntryValue | null, ip: string | null) {
	const secret = env.TURNSTILE_SECRET_KEY;
	if (!secret || typeof token !== 'string' || !token) return false;
	const body = new FormData();
	body.append('secret', secret);
	body.append('response', token);
	if (ip) body.append('remoteip', ip);
	const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
	const data = (await res.json().catch(() => ({}))) as { success?: boolean };
	return data.success === true;
}

export function isAdmin(request: Request) {
	const password = env.ADMIN_PASSWORD;
	const header = request.headers.get('authorization') ?? '';
	if (!password || !header.startsWith('Basic ')) return false;
	let given = '';
	try {
		given = atob(header.slice(6)).split(':').slice(1).join(':');
	} catch {
		return false;
	}
	const a = new TextEncoder().encode(given);
	const b = new TextEncoder().encode(password);
	return a.length === b.length && crypto.subtle.timingSafeEqual(a, b);
}

export const unauthorized = () =>
	new Response('Password needed.', {
		status: 401,
		headers: { 'www-authenticate': 'Basic realm="guestbook admin", charset="UTF-8"' },
	});

export const formatDate = (ms: number) =>
	new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
