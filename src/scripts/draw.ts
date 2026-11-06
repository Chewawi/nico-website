import { blip } from './eggs';

declare global {
	interface Window {
		turnstile?: {
			render: (el: HTMLElement, opts: Record<string, unknown>) => string;
			reset: (id?: string) => void;
		};
	}
}

const form = document.querySelector<HTMLFormElement>('[data-sign]');

if (form) {
	form.hidden = false;
	const $ = <T extends HTMLElement>(sel: string) => form.querySelector<T>(sel)!;
	const canvas = $<HTMLCanvasElement>('[data-canvas]');
	const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
	const undoBtn = $<HTMLButtonElement>('[data-undo]');
	const clearBtn = $<HTMLButtonElement>('[data-clear]');
	const saveBtn = $<HTMLButtonElement>('[data-save]');
	const sendBtn = $<HTMLButtonElement>('[data-send]');
	const eraser = $<HTMLInputElement>('[data-eraser]');
	const anyColour = $<HTMLInputElement>('[data-any-colour]');
	const status = $('[data-status]');
	const history: ImageData[] = [];
	let drawn = false;
	let widget: string | undefined;

	const blank = () => {
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	};
	blank();

	const message = form.elements.namedItem('message') as HTMLTextAreaElement;
	// A message alone is enough, so people who can't draw with a pointer can still sign.
	const sync = () => {
		undoBtn.disabled = history.length === 0;
		clearBtn.disabled = saveBtn.disabled = !drawn;
		sendBtn.disabled = !drawn && !message.value.trim();
	};
	message.addEventListener('input', sync);

	const snapshot = () => {
		history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
		if (history.length > 30) history.shift();
	};

	const colour = () => (form.elements.namedItem('colour') as RadioNodeList).value || anyColour.value;
	const size = () => Number((form.elements.namedItem('size') as RadioNodeList).value);

	anyColour.addEventListener('input', () => {
		for (const r of form.querySelectorAll<HTMLInputElement>('[name="colour"]')) r.checked = false;
		eraser.checked = false;
	});
	form.addEventListener('change', (e) => {
		if ((e.target as HTMLInputElement).name === 'colour') eraser.checked = false;
	});

	let last: { x: number; y: number } | null = null;
	const point = (e: PointerEvent) => {
		const r = canvas.getBoundingClientRect();
		return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
	};

	const line = (a: { x: number; y: number }, b: { x: number; y: number }) => {
		ctx.strokeStyle = ctx.fillStyle = eraser.checked ? '#fff' : colour();
		ctx.lineWidth = eraser.checked ? size() * 2 : size();
		ctx.lineCap = ctx.lineJoin = 'round';
		ctx.beginPath();
		ctx.moveTo(a.x, a.y);
		ctx.lineTo(b.x, b.y);
		ctx.stroke();
	};

	canvas.addEventListener('pointerdown', (e) => {
		if (e.button !== 0) return;
		canvas.setPointerCapture(e.pointerId);
		snapshot();
		last = point(e);
		line(last, { x: last.x + 0.01, y: last.y });
		drawn = true;
		sync();
	});
	canvas.addEventListener('pointermove', (e) => {
		if (!last) return;
		for (const ev of e.getCoalescedEvents?.() ?? [e]) {
			const p = point(ev);
			line(last, p);
			last = p;
		}
	});
	const end = () => (last = null);
	canvas.addEventListener('pointerup', end);
	canvas.addEventListener('pointercancel', end);

	const undo = () => {
		const prev = history.pop();
		if (!prev) return;
		ctx.putImageData(prev, 0, 0);
		drawn = prev.data.some((v) => v !== 255);
		sync();
	};
	undoBtn.addEventListener('click', undo);
	form.addEventListener('keydown', (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !(e.target as Element).closest('input, textarea')) {
			e.preventDefault();
			undo();
		}
	});

	clearBtn.addEventListener('click', () => {
		snapshot();
		blank();
		drawn = false;
		sync();
	});

	saveBtn.addEventListener('click', () => {
		const a = document.createElement('a');
		a.download = 'my-drawing.png';
		a.href = canvas.toDataURL('image/png');
		a.click();
	});

	// Turnstile loads only on this page, and only once the pad is in use.
	const turnstileBox = $('[data-turnstile]');
	let loading = false;
	const loadTurnstile = () => {
		if (loading) return;
		loading = true;
		const s = document.createElement('script');
		s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
		s.async = true;
		s.onload = () => {
			widget = window.turnstile?.render(turnstileBox, {
				sitekey: turnstileBox.dataset.sitekey,
				appearance: 'interaction-only',
			});
		};
		document.head.append(s);
	};
	form.addEventListener('pointerdown', loadTurnstile, { once: true });
	form.addEventListener('focusin', loadTurnstile, { once: true });

	const tokenReady = async () => {
		for (let i = 0; i < 40; i++) {
			const t = form.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]');
			if (t?.value) return true;
			await new Promise((r) => setTimeout(r, 250));
		}
		return false;
	};

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		if (!drawn && !message.value.trim()) return;
		sendBtn.disabled = true;
		status.className = 'form-status';
		try {
			loadTurnstile();
			status.textContent = 'checking you’re not a robot…';
			if (!(await tokenReady())) {
				throw new Error('the robot check didn’t load. if something blocks challenges.cloudflare.com, allow it and try again');
			}
			status.textContent = 'sending…';
			const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
			const data = new FormData(form);
			data.delete('colour');
			data.delete('size');
			data.delete('eraser');
			data.append('drawing', blob!, 'drawing.png');
			const res = await fetch('/api/guestbook', { method: 'POST', body: data });
			const body = (await res.json().catch(() => ({}))) as { error?: string };
			if (!res.ok) throw new Error(body.error ?? 'something went wrong. try again?');
			blank();
			history.length = 0;
			drawn = false;
			form.reset();
			status.textContent = 'sent. it shows up on the wall once i’ve seen it';
			blip([659, 784, 988, 1319], 0.09);
		} catch (err) {
			status.className = 'form-status error';
			status.textContent = (err as Error).message;
		} finally {
			window.turnstile?.reset(widget);
			sync();
		}
	});

	sync();
}
