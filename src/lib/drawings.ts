// Content loader for Nico's drawings. They live in his own GitHub repo, which is the source of truth: every build
// (and every `astro dev` start) syncs it into .drawings/ and lists what's there. The layout is explained in that repo's
// README: one folder per category, and next to any drawing an optional "<same name>.txt" with its title, alt text,
// featured and hidden. Everything is optional; a mistake in a .txt only logs a warning.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Loader } from 'astro/loaders';

const REPO = process.env.DRAWINGS_REPO ?? 'MrDino127/drawings';
const BRANCH = process.env.DRAWINGS_BRANCH ?? 'main';
const IMAGE = /\.(png|jpe?g|webp|gif|avif)$/i;
// pictures that aren't in any folder
const LOOSE = 'drawings';

type Logger = { info(m: string): void; warn(m: string): void };
type Info = { title?: string; alt?: string; featured?: boolean; hidden?: boolean };

/** Clone or update the drawings repo. DRAWINGS_DIR points at a local clone instead (no network). */
function sync(logger: Logger): string {
	if (process.env.DRAWINGS_DIR) {
		const dir = path.resolve(process.env.DRAWINGS_DIR);
		logger.info(`Using the drawings in ${dir}`);
		return dir;
	}

	const dir = path.resolve('.drawings');
	const token = process.env.DRAWINGS_TOKEN;
	// The token goes in a one-off header, so it is never written to .drawings/.git/config.
	const auth = token ? ['-c', `http.extraHeader=Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`] : [];
	const git = (args: string[], cwd?: string) =>
		execFileSync('git', [...auth, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });

	try {
		if (existsSync(path.join(dir, '.git'))) {
			git(['fetch', '--quiet', '--filter=blob:none', 'origin', BRANCH], dir);
			git(['reset', '--quiet', '--hard', 'FETCH_HEAD'], dir);
			git(['clean', '--quiet', '-fdx'], dir); // mirror the repo exactly, nothing left over
		} else {
			git(['clone', '--quiet', '--filter=blob:none', '--branch', BRANCH, `https://github.com/${REPO}.git`, dir]);
		}
		logger.info(`Synced the drawings from github.com/${REPO} (${BRANCH})`);
	} catch (error) {
		const detail = String((error as { stderr?: Buffer }).stderr ?? error).trim();
		const safe = token ? detail.replaceAll(token, '***') : detail;
		if (!existsSync(path.join(dir, '.git'))) {
			throw new Error(
				`Couldn't download the drawings from github.com/${REPO}. If the repo is private, set DRAWINGS_TOKEN ` +
					`(or point DRAWINGS_DIR at a local clone).\n${safe}`,
			);
		}
		logger.warn(`Couldn't update the drawings, using the last copy in .drawings/ (${safe.split('\n')[0]})`);
	}
	return dir;
}

/** Every file in the repo, as posix paths. Names starting with "." or "_" (files or folders) stay out of the site. */
function listFiles(dir: string, base = ''): string[] {
	return readdirSync(path.join(dir, base), { withFileTypes: true }).flatMap((entry) => {
		if (entry.name.startsWith('.') || entry.name.startsWith('_')) return [];
		const rel = path.posix.join(base, entry.name);
		return entry.isDirectory() ? listFiles(dir, rel) : [rel];
	});
}

/**
 * When each file was first added, following moves and renames, so new drawings go first and sorting them into
 * folders doesn't reorder anything. Exact renames are matched by content id, so the blob-less clone needs no
 * downloads for this. Outside a git checkout everything ties and the order is alphabetical.
 */
function addedTimes(dir: string): Map<string, number> {
	const added = new Map<string, number>();
	let log: string;
	try {
		log = execFileSync('git', ['log', '-z', '--reverse', '--format=@%ct', '--name-status', '--find-renames=100%'], {
			cwd: dir,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
			maxBuffer: 64e6,
		});
	} catch {
		return added;
	}
	// Tokens are NUL-separated: "@<time>" per commit, then a status (A, M, D, R100...) and its one or two paths.
	const tokens = log.split('\0');
	let time = 0;
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i].replace(/^\n/, '');
		if (token.startsWith('@')) time = Number(token.slice(1));
		else if (token === 'A') added.set(tokens[++i], time);
		else if (token.startsWith('R')) {
			const from = tokens[++i];
			added.set(tokens[++i], added.get(from) ?? time);
		} else if (token) i++; // M, D, T: one path, nothing to record
	}
	return added;
}

const YES = /^(yes|y|true|si|sí|1)$/i;
const NO = /^(no|n|false|0)$/i;

/** Reads "key: value" lines. A bare "featured" or "hidden" line means yes. */
function readInfo(dir: string, file: string, logger: Logger): Info {
	const info: Info = {};
	const lines = readFileSync(path.join(dir, file), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
	lines.forEach((raw, n) => {
		const line = raw.trim();
		if (!line || line.startsWith('#')) return;
		const [, key = line, value = ''] = line.match(/^([a-z]+)\s*[:=]\s*(.*)$/i) ?? [];
		const k = key.toLowerCase();
		if (k === 'title' || k === 'alt') {
			if (value.trim()) info[k] = value.trim();
		} else if ((k === 'featured' || k === 'hidden') && (!value || YES.test(value) || NO.test(value))) info[k] = !NO.test(value);
		else logger.warn(`${file}, line ${n + 1}: didn't understand "${line}"`);
	});
	return info;
}

/** "Faro PNG.png" -> "Faro", "spikey_dangley.png" -> "spikey dangley" */
function titleFrom(file: string) {
	const name = path.posix.basename(file).replace(/\.[^.]+$/, '');
	return name.replace(/[_-]+/g, ' ').replace(/\b(png|jpe?g|final)\b/gi, '').replace(/\s+/g, ' ').trim() || name;
}

export const slug = (text: string) =>
	text
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '') || 'drawing';

export function drawingsLoader(): Loader {
	return {
		name: 'drawings',
		async load({ store, parseData, logger, config, watcher }) {
			const dir = sync(logger);
			const root = fileURLToPath(config.root);

			const read = async () => {
				const files = listFiles(dir);
				// sidecars match their drawing case-insensitively, so "faro png.txt" still finds "Faro PNG.png"
				const texts = new Map(files.filter((f) => /\.txt$/i.test(f)).map((f) => [f.slice(0, -4).toLowerCase(), f]));
				const added = addedTimes(dir);

				const matched = new Set<string>();
				const drawings = files
					.filter((f) => IMAGE.test(f) && !/do not repost/i.test(f))
					.map((file) => {
						const text = texts.get(file.replace(/\.[^.]+$/, '').toLowerCase());
						if (text) matched.add(text);
						const info = text ? readInfo(dir, text, logger) : {};
						const folder = file.includes('/') ? file.slice(0, file.indexOf('/')) : LOOSE;
						const title = info.title ?? titleFrom(file);
						return { file, info, title, category: folder.replace(/[_-]+/g, ' ').trim().toLowerCase(), added: added.get(file) ?? 0 };
					})
					.filter((d) => !d.info.hidden)
					.sort((a, b) => b.added - a.added || a.title.localeCompare(b.title));

				for (const orphan of texts.values()) {
					if (!matched.has(orphan) && !/(^|\/)readme\.txt$/i.test(orphan)) logger.warn(`${orphan} has no drawing with the same name next to it`);
				}

				store.clear();
				const used = new Set<string>();
				for (const [order, d] of drawings.entries()) {
					// from the name only, so links to a drawing survive moving it to another folder
					const base = slug(path.posix.basename(d.file).replace(/\.[^.]+$/, ''));
					let id = base;
					for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
					used.add(id);

					const filePath = path.join(dir, d.file);
					const data = await parseData({
						id,
						data: {
							title: d.title,
							image: `./${path.posix.basename(d.file)}`, // resolved next to filePath
							alt: d.info.alt ?? d.title,
							category: d.category,
							featured: d.info.featured ?? false,
							order,
						},
						filePath,
					});
					store.set({ id, data, filePath: path.relative(root, filePath).split(path.sep).join('/') });
				}
				logger.info(`${drawings.length} drawings`);
			};

			await read();

			// In dev, editing the drawings folder (pictures or .txt files) updates the gallery without a restart.
			if (watcher) {
				let timer: ReturnType<typeof setTimeout> | undefined;
				watcher.add(dir);
				watcher.on('all', (_event, changed) => {
					if (!changed.startsWith(dir + path.sep) || changed.includes(`${path.sep}.git${path.sep}`)) return;
					clearTimeout(timer);
					timer = setTimeout(() => read().catch((error) => logger.error(String(error))), 300);
				});
			}
		},
	};
}
