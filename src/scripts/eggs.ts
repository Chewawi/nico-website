// Small things that react when poked. Sound only ever plays on a click.
const box = document.querySelector<HTMLElement>('[data-textbox]');
const calm = matchMedia('(prefers-reduced-motion: reduce)');
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

function playHello() {
	new Audio('/sounds/hello.ogg').play().catch(() => {});
}

const viewedJokes = ['best viewed with your eyes', 'best viewed in 800×600', 'best viewed at 3am'];
let viewed = 0;
let counterClicks = 0;

const eggs: Record<string, (el: HTMLElement) => void> = {
	hello(el) {
		playHello();
		say('* Hello.', 2500);
		el.classList.remove('talking');
		void el.offsetWidth;
		el.classList.add('talking');
	},
	bug(el) {
		blip([1400, 1800, 2200], 0.04);
		el.classList.add('flown');
		setTimeout(() => el.remove(), 1300);
	},
	viewed(el) {
		viewed = (viewed + 1) % viewedJokes.length;
		el.textContent = viewedJokes[viewed];
	},
	flower() {
		blip([392, 523, 659], 0.1);
	},
	counter(el) {
		if (++counterClicks < 5) return;
		counterClicks = 0;
		const real = el.textContent;
		el.textContent = '999999';
		blip([523, 659, 784, 1047, 784, 1047], 0.07);
		say('* Congratulations, you are visitor no. 1,000,000.\n* There is no prize.');
		setTimeout(() => (el.textContent = real), 4500);
	},
	trinket() {
		say("* (It's an egg.)", 2500);
	},
};

document.addEventListener('click', (e) => {
	const target = e.target as Element;
	const el = target.closest<HTMLElement>('[data-egg]');
	if (el) eggs[el.dataset.egg!]?.(el);

	// Discord has no profile link for a username, so the button copies it.
	const copy = target.closest<HTMLElement>('[data-copy]');
	if (copy) {
		const name = copy.dataset.copy!;
		navigator.clipboard
			?.writeText(name)
			.then(() => say(`* (copied ${name})`, 2500))
			.catch(() => say(`* it's ${name} on discord`, 4000)) ?? say(`* it's ${name} on discord`, 4000);
	}
});

// Email: the address is stored backwards in the HTML and only put together here.
for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-mail]')) {
	const [user, domain] = a.dataset.mail!.split('|').map((part) => [...part].reverse().join(''));
	const address = `${user}@${domain}`;
	a.href = `mailto:${address}`;
	const text = a.querySelector('[data-mail-text]');
	if (text) text.textContent = address;
}

// ---------- the hoodie dog (his character) ----------

let walking = false;
function walkDog() {
	if (walking || !document.body.dataset.dog) return;
	walking = true;
	const dog = new Image();
	dog.src = document.body.dataset.dog;
	if (document.body.dataset.dogRetina) dog.srcset = `${dog.src} 1x, ${document.body.dataset.dogRetina} 2x`;
	dog.alt = '';
	dog.className = 'walker';
	dog.setAttribute('aria-hidden', 'true');
	document.body.append(dog);
	const done = () => {
		dog.remove();
		walking = false;
	};
	if (calm.matches) setTimeout(done, 4000);
	else dog.addEventListener('animationend', done, { once: true });
}

// He wanders by if nobody touches anything for a while.
let idle: number | undefined;
const resetIdle = () => {
	clearTimeout(idle);
	idle = window.setTimeout(walkDog, 45_000);
};
for (const type of ['pointermove', 'keydown', 'scroll', 'touchstart']) addEventListener(type, resetIdle, { passive: true });
resetIdle();

// ---------- typed words ----------

let typed = '';
const words: Record<string, () => void> = {
	omori: () => say('* Waiting for something to happen?'),
	nico: walkDog,
};

// ---------- Konami code: Deltarune's dark world ----------

const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let progress = 0;

function feed(key: string) {
	progress = key === konami[progress] ? progress + 1 : key === konami[0] ? 1 : 0;
	if (progress < konami.length) return;
	progress = 0;
	const dark = document.documentElement.classList.toggle('dark-world');
	if (dark) {
		sessionStorage.setItem('dark-world', '1');
		fountain();
		say('* (You fell into the dark world.)\n* (Same code to leave.)', 6000);
	} else {
		sessionStorage.removeItem('dark-world');
		say('* (Back in the light world.)', 2500);
	}
}

function fountain() {
	const el = document.createElement('div');
	el.className = 'fountain';
	el.setAttribute('aria-hidden', 'true');
	el.innerHTML = `<picture>
		<source media="(prefers-reduced-motion: reduce)" srcset="/decor/dark-fountain-still.png">
		<img src="/decor/dark-fountain.gif" width="320" height="240" alt="">
	</picture>
	<p>dark fountain from DELTARUNE by Toby Fox</p>`;
	document.body.append(el);
	const close = () => {
		el.classList.add('out');
		setTimeout(() => el.remove(), calm.matches ? 0 : 500);
		removeEventListener('keydown', onKey);
	};
	const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
	el.addEventListener('click', close);
	addEventListener('keydown', onKey);
	setTimeout(close, 4200);
}

addEventListener('keydown', (e) => {
	if ((e.target as Element).closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
	const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
	feed(key);
	if (key.length === 1) {
		typed = (typed + key).slice(-8);
		for (const [word, fn] of Object.entries(words)) if (typed.endsWith(word)) fn();
	}
});

// On touch screens the code works as swipes, then two taps for B and A.
let touch: { x: number; y: number; t: number } | undefined;
addEventListener(
	'touchstart',
	(e) => {
		const t = e.changedTouches[0];
		touch = { x: t.clientX, y: t.clientY, t: e.timeStamp };
	},
	{ passive: true },
);
addEventListener(
	'touchend',
	(e) => {
		if (!touch) return;
		const t = e.changedTouches[0];
		const dx = t.clientX - touch.x;
		const dy = t.clientY - touch.y;
		if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) {
			// a tap only counts as B or A once the arrows are in
			if (progress >= 8 && e.timeStamp - touch.t < 400) feed(konami[progress]);
			else if (progress) progress = 0;
		} else if (Math.abs(dx) > Math.abs(dy)) feed(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
		else feed(dy > 0 ? 'ArrowDown' : 'ArrowUp');
		touch = undefined;
	},
	{ passive: true },
);

// ---------- the tab misses you ----------

let title = document.title;
document.addEventListener('visibilitychange', () => {
	if (document.hidden) {
		title = document.title;
		document.title = 'hello?';
	} else document.title = title;
});

// ---------- hit counter: real, counts once per browser session ----------

const counter = document.querySelector<HTMLElement>('[data-counter]');
if (counter) {
	const counted = sessionStorage.getItem('counted');
	fetch('/api/hits', { method: counted ? 'GET' : 'POST' })
		.then((r) => (r.ok ? (r.json() as Promise<{ count: number }>) : Promise.reject()))
		.then(({ count }) => {
			sessionStorage.setItem('counted', '1');
			counter.querySelector('[data-digits]')!.textContent = String(count).padStart(6, '0');
			counter.hidden = false;
		})
		.catch(() => {});
}

// The egg from behind the tree ends up with the rest of the trinkets.
const trinket = document.querySelector<HTMLElement>('[data-trinket]');
if (trinket && localStorage.getItem('egg')) trinket.hidden = false;

// ---------- a ladybug, sometimes ----------

if (Math.random() < 0.08) {
	const spots = [...document.querySelectorAll<HTMLElement>('main .paper, main .sticker, main .cutout')].filter((el) => el.offsetWidth > 60);
	const spot = spots[Math.floor(Math.random() * spots.length)];
	if (spot) {
		const bug = document.createElement('button');
		bug.type = 'button';
		bug.className = 'ladybug';
		bug.dataset.egg = 'bug';
		bug.setAttribute('aria-label', 'A ladybug');
		bug.innerHTML = `<svg viewBox="0 0 24 20" width="22" height="18" aria-hidden="true"><path d="M6 6 2 2M18 6l4-4M5 12H1M19 12h4M6 17l-3 3M18 17l3 3" stroke="#13060c" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="12" cy="12" rx="8" ry="7.5" fill="#df001d" stroke="#13060c" stroke-width="1.6"/><path d="M12 4.5v15" stroke="#13060c" stroke-width="1.4"/><circle cx="12" cy="5" r="3.4" fill="#13060c"/><circle cx="8.3" cy="11" r="1.5" fill="#13060c"/><circle cx="15.7" cy="11" r="1.5" fill="#13060c"/><circle cx="9" cy="15.5" r="1.2" fill="#13060c"/><circle cx="15" cy="15.5" r="1.2" fill="#13060c"/></svg>`;
		const along = 0.15 + Math.random() * 0.7;
		const place = () => {
			const r = spot.getBoundingClientRect();
			bug.style.left = `${r.left + scrollX + r.width * along - 11}px`;
			bug.style.top = `${r.top + scrollY - 9}px`;
		};
		document.body.append(bug);
		place();
		addEventListener('resize', place);
	}
}

// ---------- wallpaper drift ----------

if (!calm.matches) {
	const root = document.documentElement;
	let px = 0.5;
	let py = 0.5;
	let queued = false;
	const draw = () => {
		queued = false;
		root.style.setProperty('--drift-x', `${(px - 0.5) * -14}px`);
		root.style.setProperty('--drift-y', `${scrollY * -0.12 + (py - 0.5) * -10}px`);
	};
	const queue = () => {
		if (!queued) requestAnimationFrame(draw);
		queued = true;
	};
	addEventListener('scroll', queue, { passive: true });
	addEventListener(
		'pointermove',
		(e) => {
			if (e.pointerType !== 'mouse') return;
			px = e.clientX / innerWidth;
			py = e.clientY / innerHeight;
			queue();
		},
		{ passive: true },
	);
}
