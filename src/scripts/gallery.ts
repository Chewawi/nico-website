const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const q = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;

const cards = [...document.querySelectorAll<HTMLAnchorElement>('[data-gallery] .work')];
const dialog = q<HTMLDialogElement>('[data-lightbox]');
const img = q<HTMLImageElement>('[data-lb-img]', dialog);
const stage = q('[data-lb-stage]', dialog);
let current: HTMLAnchorElement | undefined;

// Dense packing can move cards; step through them in the order they appear on screen.
const visible = () =>
	cards
		.filter((c) => !c.parentElement!.hidden)
		.map((c) => ({ c, r: c.parentElement!.getBoundingClientRect() }))
		.sort((a, b) => Math.round(a.r.top - b.r.top) || a.r.left - b.r.left)
		.map(({ c }) => c);
let pushed = false;

function load(card: HTMLAnchorElement, target = img) {
	const d = card.dataset;
	const fit = Math.min(stage.clientWidth || innerWidth, (stage.clientHeight || innerHeight) * (Number(d.w) / Number(d.h)));
	target.sizes = `${Math.ceil(fit)}px`;
	target.srcset = d.srcset!;
	target.src = card.href;
	target.width = Number(d.w);
	target.height = Number(d.h);
	target.alt = d.alt ?? '';
}

function show(card: HTMLAnchorElement, first = false) {
	current = card;
	const list = visible();
	const i = list.indexOf(card);
	load(card);
	if (!reduced.matches) {
		img.classList.remove('swap');
		void img.offsetWidth;
		img.classList.add('swap');
	}
	q('[data-lb-title]', dialog).textContent = card.dataset.title!;
	q('[data-lb-meta]', dialog).textContent = card.dataset.meta ?? '';
	q('[data-lb-count]', dialog).textContent = `${String(i + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}`;
	const url = `${location.pathname}${location.search}#${card.dataset.id}`;
	// The first picture gets its own history entry so Back closes the viewer.
	if (first && !location.hash) {
		history.pushState(null, '', url);
		pushed = true;
	} else history.replaceState(null, '', url);
	for (const n of [list[i - 1], list[i + 1]]) if (n) load(n, new Image());
}

function step(by: number) {
	const list = visible();
	if (!current || list.length < 2) return;
	show(list[(list.indexOf(current) + by + list.length) % list.length]);
}

function open(card: HTMLAnchorElement) {
	const first = !dialog.open;
	if (first) dialog.showModal();
	show(card, first);
}

for (const card of cards) {
	card.addEventListener('click', (e) => {
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
		e.preventDefault();
		open(card);
	});
}

q('[data-lb-prev]', dialog).addEventListener('click', () => step(-1));
q('[data-lb-next]', dialog).addEventListener('click', () => step(1));
q('[data-lb-close]', dialog).addEventListener('click', () => dialog.close());

dialog.addEventListener('keydown', (e) => {
	if (e.key === 'ArrowLeft') step(-1);
	else if (e.key === 'ArrowRight') step(1);
	else if (e.key === 'Home') show(visible()[0]);
	else if (e.key === 'End') show(visible().at(-1)!);
	else return;
	e.preventDefault();
});

// Clicking the dark area around the picture closes the viewer.
dialog.addEventListener('click', (e) => {
	if (e.target === stage || e.target === dialog) dialog.close();
});

dialog.addEventListener('close', () => {
	if (pushed) history.back();
	else history.replaceState(null, '', location.pathname + location.search);
	pushed = false;
	current?.focus();
});

addEventListener('popstate', () => {
	if (!dialog.open) return;
	pushed = false;
	dialog.close();
});

let startX = 0;
stage.addEventListener('pointerdown', (e) => (startX = e.clientX));
stage.addEventListener('pointerup', (e) => {
	const dx = e.clientX - startX;
	if (e.pointerType !== 'mouse' && Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
});

// ---------- category filter ----------

const filters = document.querySelector<HTMLElement>('[data-filters]');
const filterStatus = q('[data-filter-status]');

function apply(cat: string, announce = true) {
	if (!filters) return;
	const chips = [...filters.querySelectorAll<HTMLButtonElement>('[data-filter]')];
	if (!chips.some((c) => c.dataset.filter === cat)) cat = 'all';
	// Only cards that are on screen before or after get a transition name, so big galleries stay quick.
	const name = (on: boolean) => {
		for (const card of cards) card.style.viewTransitionName = on && !card.parentElement!.hidden ? `w-${card.dataset.id}` : '';
	};
	const update = () => {
		for (const chip of chips) chip.setAttribute('aria-pressed', String(chip.dataset.filter === cat));
		for (const card of cards) {
			const li = card.parentElement!;
			li.hidden = cat !== 'all' && li.dataset.category !== cat;
		}
	};
	if (announce && document.startViewTransition && !reduced.matches) {
		name(true);
		const t = document.startViewTransition(() => {
			name(false);
			update();
			name(true);
		});
		t.finished.finally(() => name(false));
	} else update();
	const url = new URL(location.href);
	if (cat === 'all') url.searchParams.delete('c');
	else url.searchParams.set('c', cat);
	history.replaceState(null, '', url);
	if (announce) filterStatus.textContent = `${visible().length} drawings`;
}

if (filters) {
	filters.hidden = false;
	filters.addEventListener('click', (e) => {
		const chip = (e.target as Element).closest<HTMLButtonElement>('[data-filter]');
		if (chip) apply(chip.dataset.filter!);
	});
	apply(new URLSearchParams(location.search).get('c') ?? 'all', false);
}

const linked = location.hash && cards.find((c) => c.dataset.id === decodeURIComponent(location.hash.slice(1)));
if (linked) {
	if (linked.parentElement!.hidden) apply('all', false);
	open(linked);
}
