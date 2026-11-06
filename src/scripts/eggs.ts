const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const box = document.querySelector<HTMLElement>('[data-textbox]');
let boxTimer: number | undefined;

export function say(text: string, ms = 4500) {
	if (!box) return;
	box.textContent = text;
	box.hidden = false;
	clearTimeout(boxTimer);
	boxTimer = window.setTimeout(() => (box.hidden = true), ms);
}

box?.addEventListener('click', () => (box.hidden = true));
addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && box && !box.hidden) box.hidden = true;
});

let audio: AudioContext | undefined;

// Square-wave chiptune notes, synthesised so there are no sound files to host.
export function blip(notes: number[], step = 0.08) {
	audio ??= new AudioContext();
	const t0 = audio.currentTime;
	notes.forEach((freq, i) => {
		const osc = audio!.createOscillator();
		const gain = audio!.createGain();
		const t = t0 + i * step;
		osc.type = 'square';
		osc.frequency.value = freq;
		gain.gain.setValueAtTime(0.05, t);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + step * 1.6);
		osc.connect(gain).connect(audio!.destination);
		osc.start(t);
		osc.stop(t + step * 1.7);
	});
}

const helloFiles = ['/sounds/hello.ogg', '/sounds/hello.mp3'].filter((src) =>
	new Audio().canPlayType(src.endsWith('ogg') ? 'audio/ogg' : 'audio/mpeg'),
);

function playHello(i = 0) {
	if (i >= helloFiles.length) return;
	const a = new Audio(helloFiles[i]);
	a.addEventListener('error', () => playHello(i + 1), { once: true });
	a.play().catch(() => {});
}

const viewedJokes = [
	'best viewed with your eyes',
	'best viewed in 800×600',
	'best viewed at 3 am',
	'best viewed with a snack',
	'best viewed in netscape navigator 4',
	'best viewed with a friend',
];
let viewed = 0;

const eggs: Record<string, (el: HTMLElement) => void> = {
	hello(el) {
		playHello();
		say('* Hello.', 2500);
		el.classList.remove('talking');
		void el.offsetWidth;
		el.classList.add('talking');
	},
	save() {
		blip([523, 659, 784, 1047]);
		say('* (The sight of so many drawings fills you with DETERMINATION.)\n* Progress saved.');
	},
	bug(el) {
		blip([1400, 1800, 2200], 0.04);
		el.classList.add('flown');
		say('* The ladybug flew away.\n* It will be back on the next page.', 3500);
	},
	viewed(el) {
		viewed = (viewed + 1) % viewedJokes.length;
		el.textContent = viewedJokes[viewed];
	},
	flower() {
		blip([392, 523, 659], 0.1);
	},
};

document.addEventListener('click', (e) => {
	const el = (e.target as Element).closest<HTMLElement>('[data-egg]');
	if (el) eggs[el.dataset.egg!]?.(el);
});

// Konami code toggles Deltarune's dark world.
const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let progress = 0;
addEventListener('keydown', (e) => {
	if ((e.target as Element).closest('input, textarea, select, [contenteditable]')) return;
	const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
	progress = key === konami[progress] ? progress + 1 : key === konami[0] ? 1 : 0;
	if (progress < konami.length) return;
	progress = 0;
	const dark = document.documentElement.classList.toggle('dark-world');
	if (dark) sessionStorage.setItem('dark-world', '1');
	else sessionStorage.removeItem('dark-world');
	blip(dark ? [330, 247, 196, 147] : [147, 196, 247, 330], 0.12);
	say(dark ? '* You fell into the DARK WORLD.\n* (Type the code again to go back.)' : '* You returned to the LIGHT WORLD.');
});

// Real hit counter; only counts once per browser session.
const counter = document.querySelector<HTMLElement>('[data-counter]');
if (counter) {
	const counted = sessionStorage.getItem('counted');
	fetch('/api/hits', { method: counted ? 'GET' : 'POST' })
		.then((r) => (r.ok ? r.json() : Promise.reject()))
		.then(({ count }: { count: number }) => {
			sessionStorage.setItem('counted', '1');
			counter.querySelector('[data-digits]')!.textContent = String(count).padStart(6, '0');
			counter.hidden = false;
		})
		.catch(() => {});
}

export { reduced };
