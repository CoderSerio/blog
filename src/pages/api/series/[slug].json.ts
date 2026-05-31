import { getAllSeries, getSeriesBySlug } from "@/content/series";
import { getPostsBySlugs } from "@utils/content-utils";
import { getPostUrlBySlug, getSeriesUrlBySlug } from "@utils/url-utils";
import type { APIRoute, GetStaticPaths } from "astro";

export const getStaticPaths: GetStaticPaths = (() =>
	getAllSeries().map((series) => ({
		params: { slug: series.slug },
	}))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
	const series = params.slug ? getSeriesBySlug(params.slug) : null;

	if (!series) {
		return new Response("Not found", { status: 404 });
	}

	const posts = await getPostsBySlugs(series.posts);

	return new Response(
		JSON.stringify({
			slug: series.slug,
			title: series.title,
			description: series.description,
			url: getSeriesUrlBySlug(series.slug),
			links: series.links ?? [],
			posts: posts.map((post) => ({
				slug: post.slug,
				title: post.data.title,
				url: getPostUrlBySlug(post.slug),
				draft: post.data.draft,
			})),
		}),
		{
			headers: {
				"Content-Type": "application/json; charset=utf-8",
			},
		},
	);
};
