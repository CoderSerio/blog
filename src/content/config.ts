import { defineCollection, z } from "astro:content";
import type { CollectionConfig } from "astro/content/config";

type PostSchemaData = {
	title: string;
	published: Date;
	updated?: Date;
	draft: boolean;
	description: string;
	image: string;
	tags: string[];
	category: string | null;
	lang: string;
	prevTitle: string;
	prevSlug: string;
	nextTitle: string;
	nextSlug: string;
};

type SpecSchemaData = Record<string, never>;

const postsSchema: z.ZodType<PostSchemaData, z.ZodTypeDef, unknown> = z.object({
	title: z.string(),
	published: z.date(),
	updated: z.date().optional(),
	draft: z.boolean().optional().default(false),
	description: z.string().optional().default(""),
	image: z.string().optional().default(""),
	tags: z.array(z.string()).optional().default([]),
	category: z.string().optional().nullable().default(""),
	lang: z.string().optional().default(""),

	/* For internal use */
	prevTitle: z.string().default(""),
	prevSlug: z.string().default(""),
	nextTitle: z.string().default(""),
	nextSlug: z.string().default(""),
});

const specSchema: z.ZodType<SpecSchemaData, z.ZodTypeDef, unknown> = z.object(
	{},
);

const postsCollection: CollectionConfig<typeof postsSchema> = defineCollection({
	schema: postsSchema,
});
const specCollection: CollectionConfig<typeof specSchema> = defineCollection({
	schema: specSchema,
});
export const collections: {
	posts: typeof postsCollection;
	spec: typeof specCollection;
} = {
	posts: postsCollection,
	spec: specCollection,
};
