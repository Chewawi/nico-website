import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { drawingsLoader } from './lib/drawings';

// Synced from Nico's drawings repo at build time (see src/lib/drawings.ts).
const drawings = defineCollection({
	loader: drawingsLoader(),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			image: image(),
			alt: z.string(),
			category: z.string(),
			featured: z.boolean(),
			order: z.number(),
		}),
});

export const collections = { drawings };
