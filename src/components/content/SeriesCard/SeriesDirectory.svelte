<script lang="ts">
import { onMount } from "svelte";

type SeriesPost = {
	slug: string;
	title: string;
	url: string;
	draft?: boolean;
};

const storagePrefix = "series-directory:";

export let title: string;
export let description: string | undefined = undefined;
export let currentSlug: string;
export let seriesUrl: string;
export let dataUrl: string;

let posts: SeriesPost[] = [];
let loaded = false;
let loading = true;

$: currentIndex = posts.findIndex((post) => post.slug === currentSlug);
$: seriesLabel =
	loaded && currentIndex !== -1
		? `Series ${currentIndex + 1} of ${posts.length}`
		: "Series";

function readCachedPosts(dataUrl: string): SeriesPost[] | null {
	const raw = sessionStorage.getItem(`${storagePrefix}${dataUrl}`);
	if (!raw) return null;

	try {
		return JSON.parse(raw) as SeriesPost[];
	} catch {
		sessionStorage.removeItem(`${storagePrefix}${dataUrl}`);
		return null;
	}
}

function writeCachedPosts(dataUrl: string, posts: SeriesPost[]) {
	sessionStorage.setItem(`${storagePrefix}${dataUrl}`, JSON.stringify(posts));
}

onMount(async () => {
	try {
		const cachedPosts = readCachedPosts(dataUrl);
		if (cachedPosts) {
			posts = cachedPosts;
			loaded = true;
			loading = false;
		}

		const response = await fetch(dataUrl, { cache: "no-store" });
		if (!response.ok) return;

		const data = await response.json();
		posts = data.posts ?? [];
		writeCachedPosts(dataUrl, posts);
		loaded = true;
	} catch {
		loaded = posts.length > 0;
	} finally {
		loading = false;
	}
});
</script>

<section class="card-base mb-6 rounded-2xl border border-black/5 px-5 py-4 onload-animation dark:border-white/10" aria-busy={loading}>
    <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
                <a href={seriesUrl} class="link-lg text-sm font-semibold text-[var(--primary)]">
                    {seriesLabel}
                </a>
                <div class="mt-1 text-lg font-bold text-90">{title}</div>
                {#if description}
                    <p class="m-0 mt-1 text-sm text-50">{description}</p>
                {/if}
            </div>
            <a href={seriesUrl} class="btn-regular h-9 shrink-0 rounded-xl px-3 text-sm font-semibold">
                View series
            </a>
        </div>

        {#if loading}
            <div class="flex flex-col gap-2 border-t border-dashed border-black/10 pt-3 dark:border-white/15" aria-hidden="true">
                <div class="flex items-center gap-3 rounded-xl px-3 py-2">
                    <div class="h-6 w-6 shrink-0 animate-pulse rounded-lg bg-black/5 dark:bg-white/10"></div>
                    <div class="h-4 w-3/4 animate-pulse rounded-md bg-black/5 dark:bg-white/10"></div>
                </div>
                <div class="flex items-center gap-3 rounded-xl px-3 py-2">
                    <div class="h-6 w-6 shrink-0 animate-pulse rounded-lg bg-black/5 dark:bg-white/10"></div>
                    <div class="h-4 w-1/2 animate-pulse rounded-md bg-black/5 dark:bg-white/10"></div>
                </div>
            </div>
        {:else if loaded && posts.length > 0}
            <ol class="m-0 flex list-none flex-col gap-1 border-t border-dashed border-black/10 p-0 pt-3 dark:border-white/15">
                {#each posts as post, index}
                    <li>
                        <a
                            href={post.url}
                            aria-current={post.slug === currentSlug ? "page" : undefined}
                            class={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/10 ${post.slug === currentSlug ? "text-[var(--primary)]" : "text-75"}`}
                        >
                            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-black/5 text-xs font-bold dark:bg-white/10">
                                {index + 1}
                            </span>
                            <span class="min-w-0 flex-1 truncate font-medium">{post.title}</span>
                            {#if post.draft}
                                <span class="rounded-md bg-black/5 px-2 py-0.5 text-xs text-50 dark:bg-white/10">draft</span>
                            {/if}
                        </a>
                    </li>
                {/each}
            </ol>
        {/if}
    </div>
</section>
