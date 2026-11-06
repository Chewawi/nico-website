// Local stand-in for `cloudflare:workers`, used by `astro dev` on systems where
// Cloudflare's workerd can't run (musl Linux). D1 becomes a SQLite file.
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const vars: Record<string, string> = {};
const varsFile = existsSync('.dev.vars') ? '.dev.vars' : '.dev.vars.example';
for (const line of readFileSync(varsFile, 'utf8').split('\n')) {
	const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
	if (m) vars[m[1]] = m[2].trim();
}
const wrangler = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, ''));

mkdirSync('.wrangler/local', { recursive: true });
const sqlite = new DatabaseSync('.wrangler/local/d1.sqlite');
sqlite.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)');
const applied = new Set(sqlite.prepare('SELECT name FROM _migrations').all().map((r) => String(r.name)));
for (const file of readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort()) {
	if (applied.has(file)) continue;
	sqlite.exec(readFileSync(`migrations/${file}`, 'utf8'));
	sqlite.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
}

type Value = string | number | null | Uint8Array;

class Statement {
	constructor(
		private sql: string,
		private params: Value[] = [],
	) {}
	bind(...values: unknown[]) {
		return new Statement(this.sql, values.map((v) => (v instanceof ArrayBuffer ? new Uint8Array(v) : v)) as Value[]);
	}
	async first<T>() {
		return (sqlite.prepare(this.sql).get(...this.params) as T) ?? null;
	}
	async all<T>() {
		return { results: sqlite.prepare(this.sql).all(...this.params) as T[] };
	}
	async run() {
		return sqlite.prepare(this.sql).run(...this.params);
	}
}

export const env = {
	...wrangler.vars,
	...vars,
	DB: { prepare: (sql: string) => new Statement(sql) },
};
