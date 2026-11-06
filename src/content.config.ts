import { defineCollection, reference } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

const categories = defineCollection({
	loader: file('./src/content/categories.yaml'),
	schema: z.object({
		label: z.string(),
		hidden: z.boolean().default(false),
	}),
});

const works = defineCollection({
	loader: file('./src/content/works/works.yaml'),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			image: image(),
			alt: z.string().optional(),
			year: z.number().int().optional(),
			medium: z.string().optional(),
			category: reference('categories'),
			featured: z.boolean().default(false),
		}),
});

export const collections = { categories, works };
