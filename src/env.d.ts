// Just the Cloudflare bindings this site uses, so the full Workers runtime types
// don't clash with the browser DOM types in the client scripts.

interface D1Result<T> {
	results: T[];
}

interface D1PreparedStatement {
	bind(...values: unknown[]): D1PreparedStatement;
	first<T = Record<string, unknown>>(): Promise<T | null>;
	all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
	run(): Promise<unknown>;
}

interface D1Database {
	prepare(query: string): D1PreparedStatement;
}

declare module 'cloudflare:workers' {
	export const env: {
		DB: D1Database;
		TURNSTILE_SITE_KEY: string;
		TURNSTILE_SECRET_KEY?: string;
		ADMIN_PASSWORD?: string;
	};
}
