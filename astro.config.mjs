// @ts-check

import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

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
	adapter: cloudflare({ imageService: 'compile', prerenderEnvironment: 'node' }),
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
