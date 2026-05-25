import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    locale: z.enum(["it", "en"]).default("it"),
    tags: z.array(z.string()).default([]),
    author: z.string().default("futugrana"),
    cover: z.string().optional(),
  }),
});

const docs = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    locale: z.enum(["it", "en"]).default("it"),
    category: z.enum(["setup", "operations", "troubleshooting", "billing"]),
    order: z.number().default(100),
  }),
});

export const collections = { blog, docs };
