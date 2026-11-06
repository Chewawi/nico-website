// Content loader for Nico's drawings. They live in their own GitHub repo, which is the source of truth:
// every build (and every `astro dev` start) syncs it into .drawings/ and lists what's there.
// The repo can hold an optional drawings.yaml with per-drawing info; see docs/drawings-repo/drawings.yaml.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Loader } from 'astro/loaders';
import { parse } from 'yaml';

const REPO = process.env.DRAWINGS_REPO ?? 'MrDino127/drawings';
const BRANCH = process.env.DRAWINGS_BRANCH ?? 'main';
const IMAGE = /\.(png|jpe?g|webp|gif|avif)$/i;
const DEFAULT_CATEGORY = 'drawings';

type Info = {
	title?: string;
	category?: string;
	featured?: boolean;
	alt?: string;
	year?: number | string;
	medium?: string;
	hidden?: boolean;
};

type Meta = { drawings?: Record<string, Info | null>; 'hide categories'?: string[] };

/** Clone or update the drawings repo. DRAWINGS_DIR points at a local clone instead (no network). */
function sync(logger: { info(m: string): void; warn(m: string): void }): { dir: string; git: boolean } {
	if (process.env.DRAWINGS_DIR) {
		const dir = path.resolve(process.env.DRAWINGS_DIR);
		logger.info(`Using the drawings in ${dir}`);
		return { dir, git: existsSync(path.join(dir, '.git')) };
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
	return { dir, git: true };
}

function listImages(dir: string, base = ''): string[] {
	return readdirSync(path.join(dir, base), { withFileTypes: true }).flatMap((entry) => {
		// files and folders starting with "." or "_" stay out of the site
		if (entry.name.startsWith('.') || entry.name.startsWith('_')) return [];
		const rel = path.posix.join(base, entry.name);
		if (entry.isDirectory()) return listImages(dir, rel);
		return IMAGE.test(entry.name) && !/do not repost/i.test(entry.name) ? [rel] : [];
	});
}

/** Last commit time per file, so new drawings that aren't in drawings.yaml show up first. */
function commitTimes(dir: string): Map<string, number> {
	const times = new Map<string, number>();
	try {
		const log = execFileSync('git', ['log', '--format=@%ct', '--name-only', '--no-renames'], { cwd: dir, encoding: 'utf8', maxBuffer: 32e6 });
		let time = 0;
		for (const line of log.split('\n')) {
			if (line.startsWith('@')) time = Number(line.slice(1));
			else if (line && !times.has(line)) times.set(line, time);
		}
	} catch {
		// not a git checkout: fall back to alphabetical
	}
	return times;
}

/** "Faro PNG.png" -> "Faro", "spikey_dangley.png" -> "spikey dangley" */
function titleFrom(file: string) {
	const name = path.posix.basename(file).replace(/\.[^.]+$/, '');
	return name.replace(/[_-]+/g, ' ').replace(/\b(png|jpe?g|final)\b/gi, '').replace(/\s+/g, ' ').trim() || name;
}

/** Folder name if it's in one, otherwise a guess from the name, otherwise "drawings". */
function categoryFrom(file: string) {
	const folder = path.posix.dirname(file);
	if (folder !== '.') return folder.split('/')[0].replace(/[_-]+/g, ' ');
	if (/sheet/i.test(file)) return 'sheets';
	if (/logo|tipo/i.test(file)) return 'logos';
	return DEFAULT_CATEGORY;
}

const slug = (text: string) =>
	text
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/\.[^.]+$/, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '') || 'drawing';

export function drawingsLoader(): Loader {
	return {
		name: 'drawings',
		async load({ store, parseData, logger, config, watcher }) {
			const { dir, git } = sync(logger);
			const root = fileURLToPath(config.root);

			const read = async () => {
				const metaFile = ['drawings.yaml', 'drawings.yml'].map((f) => path.join(dir, f)).find(existsSync);
				let meta: Meta = {};
				if (metaFile) {
					try {
						meta = (parse(readFileSync(metaFile, 'utf8')) as Meta) ?? {};
					} catch (error) {
						// fail the build so the live site keeps the last good version
						throw new Error(`drawings.yaml has a mistake in it: ${(error as Error).message}`);
					}
				}
				const info = meta.drawings ?? {};
				const hiddenCategories = new Set((meta['hide categories'] ?? []).map((c) => String(c).toLowerCase()));

				const files = listImages(dir);
				const present = new Set(files);
				for (const name of Object.keys(info)) {
					if (!present.has(name) && !/do not repost/i.test(name)) logger.warn(`drawings.yaml mentions "${name}", but there's no such file`);
				}

				// listed drawings first, in file order; the rest newest first
				const listed = Object.keys(info).filter((name) => present.has(name));
				const times = git ? commitTimes(dir) : new Map<string, number>();
				const rest = files
					.filter((f) => !(f in info))
					.sort((a, b) => (times.get(b) ?? 0) - (times.get(a) ?? 0) || a.localeCompare(b));

				store.clear();
				const used = new Set<string>();
				let order = 0;
				for (const file of [...listed, ...rest]) {
					const given = info[file] ?? {};
					if (given.hidden) continue;
					const category = (given.category ?? categoryFrom(file)).toString().trim().toLowerCase();
					if (hiddenCategories.has(category)) continue;

					let id = slug(file);
					for (let n = 2; used.has(id); n++) id = `${slug(file)}-${n}`;
					used.add(id);

					const title = given.title?.toString() ?? titleFrom(file);
					const data = await parseData({
						id,
						data: {
							title,
							image: `./${file}`,
							alt: given.alt ?? title,
							category,
							featured: given.featured ?? false,
							year: given.year,
							medium: given.medium,
							file,
							order: order++,
						},
						// image paths resolve relative to this file, i.e. the repo root
						filePath: path.join(dir, 'drawings.yaml'),
					});
					store.set({ id, data, filePath: path.relative(root, path.join(dir, 'drawings.yaml')).split(path.sep).join('/') });
				}
				logger.info(`${order} drawings (${files.length - order} hidden)`);
			};

			await read();

			// In dev, editing the drawings folder (or drawings.yaml) updates the gallery without a restart.
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
