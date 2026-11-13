// @ts-check

import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import { existsSync } from 'node:fs';
import { defineConfig, envField, fontProviders } from 'astro/config';

// Astro doesn't pass .env to this file or to the drawings loader, which read SITE and DRAWINGS_* at build time.
if (existsSync('.env')) process.loadEnvFile();

// On Vercel the address is the project's production domain.
const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const site = process.env.SITE ?? (vercelDomain ? `https://${vercelDomain}` : 'https://nico.kodeko.org');

// Read when the server runs, so they can change without a rebuild.
const setting = (options = {}) => envField.string({ context: 'server', access: 'secret', optional: true, ...options });

const local = (name, cssVariable, fallbacks, variants) => ({
	provider: fontProviders.local(),
	name,
	cssVariable,
	fallbacks,
	options: {
		variants: variants.map(([file, weight = 400, style = 'normal']) => ({
			src: [`./src/assets/fonts/${file}.woff2`],
			weight,
			style,
			display: 'swap',
		})),
	},
});

export default defineConfig({
	site,
	// The Node server only trusts the Host header for this domain (and localhost); the guestbook's same-origin
	// checks need that behind a proxy.
	security: { allowedDomains: [{ hostname: new URL(site).hostname }] },
	// Vercel sets VERCEL in its builds; anywhere else this is a plain Node server.
	adapter: process.env.VERCEL ? vercel() : node({ mode: 'standalone' }),
	env: {
		schema: {
			ADMIN_PASSWORD: setting(),
			// see src/lib/db.ts
			DATABASE_PATH: setting({ optional: false, default: 'data/guestbook.sqlite' }),
			TURSO_DATABASE_URL: setting(),
			TURSO_AUTH_TOKEN: setting(),
			TURNSTILE_SITE_KEY: setting(),
			TURNSTILE_SECRET_KEY: setting(),
		},
	},
	// a local clone of the drawings repo outside this folder (see src/lib/drawings.ts)
	...(process.env.DRAWINGS_DIR && { vite: { server: { fs: { allow: ['.', process.env.DRAWINGS_DIR] } } } }),
	session: false,
	integrations: [sitemap({ filter: (page) => !/\/(admin|fun|egg)\/?$/.test(page) })],
	image: { responsiveStyles: false },
	fonts: [
		local('Atkinson Hyperlegible', '--font-text', ['system-ui', 'sans-serif'], [
			['atkinson-400'],
			['atkinson-700', 700],
			['atkinson-400-italic', 400, 'italic'],
		]),
		local('Bowlby One', '--font-chunky', ['Impact', 'sans-serif'], [['bowlby-one']]),
		local('Rock Salt', '--font-scrawl', ['cursive'], [['rock-salt']]),
		local('Zeyada', '--font-script', ['cursive'], [['zeyada']]),
		local('Silkscreen', '--font-pixel', ['monospace'], [['silkscreen']]),
	],
});
