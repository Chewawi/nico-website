// The guestbook database: Turso (hosted SQLite) when TURSO_DATABASE_URL is set, which hosts without a disk like
// Vercel need, otherwise a SQLite file. Either way the tables in migrations/ are created on first use.
import path from 'node:path';
import { DATABASE_PATH, TURSO_AUTH_TOKEN, TURSO_DATABASE_URL } from 'astro:env/server';

type Value = string | number | null | Uint8Array;
type Row = Record<string, unknown>;

interface Driver {
	query(sql: string, params: Value[]): Promise<Row[]>;
	/** Runs a script of several statements. */
	exec(sql: string): Promise<void>;
}

const migrations = Object.entries(
	import.meta.glob<string>('../../migrations/*.sql', { query: '?raw', import: 'default', eager: true }),
)
	.map(([file, sql]) => [path.basename(file), sql] as const)
	.sort(([a], [b]) => a.localeCompare(b));

async function turso(url: string): Promise<Driver> {
	const { createClient } = await import('@libsql/client/web');
	const client = createClient({ url, authToken: TURSO_AUTH_TOKEN });
	return {
		query: async (sql, args) => (await client.execute({ sql, args })).rows,
		exec: (sql) => client.executeMultiple(sql),
	};
}

async function file(): Promise<Driver> {
	if (process.env.VERCEL) {
		throw new Error('Vercel has no disk for a SQLite file. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (see the README).');
	}
	const { mkdirSync } = await import('node:fs');
	const { DatabaseSync } = await import('node:sqlite');
	const location = path.resolve(DATABASE_PATH);
	mkdirSync(path.dirname(location), { recursive: true });
	const sqlite = new DatabaseSync(location);
	return {
		query: async (sql, params) => sqlite.prepare(sql).all(...params) as Row[],
		exec: async (sql) => sqlite.exec(sql),
	};
}

async function open() {
	const driver = TURSO_DATABASE_URL ? await turso(TURSO_DATABASE_URL) : await file();
	await driver.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)');
	const applied = new Set((await driver.query('SELECT name FROM _migrations', [])).map((row) => String(row.name)));
	for (const [name, sql] of migrations) {
		if (applied.has(name)) continue;
		await driver.exec(sql);
		await driver.query('INSERT INTO _migrations (name) VALUES (?)', [name]);
	}
	return driver;
}

let driver: Promise<Driver> | undefined;
const connect = () =>
	(driver ??= open().catch((error) => {
		driver = undefined; // try again on the next request
		throw error;
	}));

export async function query<T = Row>(sql: string, ...params: Value[]) {
	return (await (await connect()).query(sql, params)) as T[];
}

export async function first<T = Row>(sql: string, ...params: Value[]) {
	return (await query<T>(sql, ...params))[0] ?? null;
}
