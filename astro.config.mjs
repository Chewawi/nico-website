// @ts-check

import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

// Cloudflare's local runtime (workerd) needs glibc. On musl systems, `astro dev` runs
// without the adapter and uses a SQLite stand-in for D1 instead. Builds always use Cloudflare.
const glibc = Boolean(process.report?.getReport().header.glibcVersionRuntime);
const localRuntime = process.argv.includes('dev') && !glibc;

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
	site: 'https://nico.kodeko.org',
	adapter: localRuntime ? undefined : cloudflare({ imageService: 'compile', prerenderEnvironment: 'node' }),
	vite: localRuntime
		? { resolve: { alias: { 'cloudflare:workers': new URL('./src/dev/workers-local.ts', import.meta.url).pathname } } }
		: {},
	session: false,
	integrations: [sitemap({ filter: (page) => !/\/(admin|fun)\/?$/.test(page) })],
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
