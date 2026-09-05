export type SeriesLink = {
	label: string;
	href: string;
};

export type SeriesConfig = {
	title: string;
	description?: string;
	links?: readonly SeriesLink[];
	posts: readonly string[];
};

export const series: Record<string, SeriesConfig> = {
	feopack: {
		title: "Feopack",
		description: "Notes from learning Rspack by building a small Rust bundler.",
		links: [
			{
				label: "Project code",
				href: "https://github.com/atom-universe/feopack",
			},
		],
		posts: [
			"feopack",
			"feopack-from-source-to-bundle",
			"loaders-of-rspack",
			"feopack-pitch-and-js-loaders",
			"feopack-loaders-and-hooks",
		],
	},
};

export type SeriesEntry = SeriesConfig & {
	slug: string;
};

export type PostSeriesEntry = SeriesEntry & {
	currentIndex: number;
};

export function getAllSeries(): SeriesEntry[] {
	return Object.entries(series).map(([slug, config]) => ({
		slug,
		...config,
	}));
}

export function getSeriesBySlug(slug: string): SeriesEntry | null {
	const config = series[slug as keyof typeof series];
	if (!config) return null;

	return {
		slug,
		...config,
	};
}

export function getSeriesForPost(slug: string): PostSeriesEntry | null {
	for (const [seriesSlug, config] of Object.entries(series)) {
		const posts = config.posts as readonly string[];
		const currentIndex = posts.indexOf(slug);
		if (currentIndex !== -1) {
			return {
				slug: seriesSlug,
				...config,
				currentIndex,
			};
		}
	}

	return null;
}
