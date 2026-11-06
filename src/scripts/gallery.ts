const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const q = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;

const cards = [...document.querySelectorAll<HTMLAnchorElement>('[data-gallery] .work')];
const dialog = q<HTMLDialogElement>('[data-lightbox]');
const img = q<HTMLImageElement>('[data-lb-img]', dialog);
const stage = q('[data-lb-stage]', dialog);
let current: HTMLAnchorElement | undefined;

const visible = () => cards.filter((c) => !c.parentElement!.hidden);

function load(card: HTMLAnchorElement, target = img) {
	const d = card.dataset;
	target.srcset = d.srcset!;
	target.sizes = '(min-width: 1200px) 80vw, 100vw';
	target.src = card.href;
	target.width = Number(d.w);
	target.height = Number(d.h);
	target.alt = d.alt ?? '';
}

function show(card: HTMLAnchorElement) {
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
	history.replaceState(null, '', `${location.pathname}${location.search}#${card.dataset.id}`);
	for (const n of [list[i - 1], list[i + 1]]) if (n) load(n, new Image());
}

function step(by: number) {
	const list = visible();
	if (!current || list.length < 2) return;
	show(list[(list.indexOf(current) + by + list.length) % list.length]);
}

function open(card: HTMLAnchorElement) {
	show(card);
	if (!dialog.open) dialog.showModal();
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
	history.replaceState(null, '', location.pathname + location.search);
	current?.focus();
});

let startX = 0;
stage.addEventListener('pointerdown', (e) => (startX = e.clientX));
stage.addEventListener('pointerup', (e) => {
	const dx = e.clientX - startX;
	if (e.pointerType !== 'mouse' && Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
});

// ---------- category filter ----------

const filters = document.querySelector<HTMLElement>('[data-filters]');
const status = q('[data-filter-status]');

function apply(cat: string, announce = true) {
	if (!filters) return;
	const chips = [...filters.querySelectorAll<HTMLButtonElement>('[data-filter]')];
	if (!chips.some((c) => c.dataset.filter === cat)) cat = 'all';
	const update = () => {
		for (const chip of chips) chip.setAttribute('aria-pressed', String(chip.dataset.filter === cat));
		for (const card of cards) {
			const li = card.parentElement!;
			li.hidden = cat !== 'all' && li.dataset.category !== cat;
		}
	};
	if (announce && document.startViewTransition && !reduced.matches) document.startViewTransition(update);
	else update();
	const url = new URL(location.href);
	if (cat === 'all') url.searchParams.delete('c');
	else url.searchParams.set('c', cat);
	history.replaceState(null, '', url);
	if (announce) status.textContent = `Showing ${visible().length} works`;
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
