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
			year: z.union([z.number(), z.string()]).optional(),
			medium: z.string().optional(),
			file: z.string(),
			order: z.number(),
		}),
});

export const collections = { drawings };
