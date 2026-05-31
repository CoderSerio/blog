<script lang="ts">
import Icon from "@iconify/svelte";
import { onDestroy, onMount } from "svelte";
import { fly } from "svelte/transition";

type Segment = {
	text: string;
};

const ARTICLE_SELECTOR = ".markdown-content";
const READABLE_BLOCK_SELECTOR = "h2, h3, h4, p, li, blockquote";
const SKIPPED_CONTAINER_SELECTOR =
	"pre, code, table, figure, .expressive-code, .mermaid, .katex-display";
const MAX_WORDS_PER_SEGMENT = 55;
const UNNATURAL_VOICE_PATTERN =
	/(bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|princess|superstar|trinoids|whisper|zarvox)/i;
const NATURAL_VOICE_PATTERN =
	/(natural|neural|premium|enhanced|online|aria|ava|jenny|guy|andrew|emma|brian|samantha|alex|daniel|serena|victoria|karen|moira|tessa|allison|susan|tom|zoe|jamie|evan|nathan|nicky|google)/i;

export let title = "Article";
export let lang = "en";

let segments: Segment[] = [];
let visible = false;
let mounted = false;
let supported = false;
let isPlaying = false;
let isPaused = false;
let finished = false;
let currentIndex = 0;
let segmentCharIndex = 0;
let voices: SpeechSynthesisVoice[] = [];
let activeUtterance: SpeechSynthesisUtterance | null = null;
let playbackToken = 0;

$: activeSegment = segments[currentIndex];
$: totalChars = segments.reduce(
	(total, segment) => total + segment.text.length,
	0,
);
$: completedChars = segments
	.slice(0, currentIndex)
	.reduce((total, segment) => total + segment.text.length, 0);
$: progressRatio = totalChars
	? Math.min(1, (completedChars + segmentCharIndex) / totalChars)
	: 0;
$: progressPercent = `${Math.round(progressRatio * 100)}%`;
$: statusLabel = getStatusLabel();

function normalizeText(text: string) {
	return text.replace(/\s+/g, " ").trim();
}

function countWords(text: string) {
	return text.split(/\s+/).filter(Boolean).length;
}

function splitLongSentence(text: string) {
	const words = text.split(/\s+/).filter(Boolean);
	const chunks: string[] = [];

	for (let index = 0; index < words.length; index += MAX_WORDS_PER_SEGMENT) {
		chunks.push(words.slice(index, index + MAX_WORDS_PER_SEGMENT).join(" "));
	}

	return chunks;
}

function splitIntoSegments(text: string) {
	const normalized = normalizeText(text);

	if (!normalized) return [];
	if (countWords(normalized) <= MAX_WORDS_PER_SEGMENT) return [normalized];

	const sentences = normalized.match(
		/[^.!?。！？]+[.!?。！？]+["')\]]?|[^.!?。！？]+$/g,
	) ?? [normalized];
	const segments: string[] = [];
	let buffer = "";

	for (const sentence of sentences.map(normalizeText).filter(Boolean)) {
		if (countWords(sentence) > MAX_WORDS_PER_SEGMENT) {
			if (buffer) {
				segments.push(buffer);
				buffer = "";
			}
			segments.push(...splitLongSentence(sentence));
			continue;
		}

		const candidate = buffer ? `${buffer} ${sentence}` : sentence;

		if (countWords(candidate) > MAX_WORDS_PER_SEGMENT && buffer) {
			segments.push(buffer);
			buffer = sentence;
		} else {
			buffer = candidate;
		}
	}

	if (buffer) segments.push(buffer);

	return segments;
}

function isNestedDuplicateBlock(element: Element) {
	const tagName = element.tagName.toLowerCase();

	if (tagName === "p" && element.closest("li, blockquote")) return true;
	if (tagName === "li" && element.closest("li li")) return true;

	return false;
}

function getReadableText(element: Element) {
	const clone = element.cloneNode(true) as Element;

	clone.querySelectorAll('a[href^="#"], .copy-btn').forEach((node) => {
		node.remove();
	});

	return normalizeText(clone.textContent ?? "");
}

function collectSegments() {
	const article = document.querySelector(ARTICLE_SELECTOR);

	if (!article) {
		segments = [];
		return;
	}

	const nextSegments: Segment[] = [];
	const blocks = article.querySelectorAll(READABLE_BLOCK_SELECTOR);

	for (const block of blocks) {
		if (block.closest(SKIPPED_CONTAINER_SELECTOR)) continue;
		if (isNestedDuplicateBlock(block)) continue;

		const text = getReadableText(block);

		for (const segment of splitIntoSegments(text)) {
			nextSegments.push({ text: segment });
		}
	}

	segments = nextSegments;
	currentIndex = Math.min(currentIndex, Math.max(segments.length - 1, 0));
}

function normalizeLang(value: string) {
	return value.replace("_", "-") || navigator.language || "en-US";
}

function voiceMatchesLanguage(voice: SpeechSynthesisVoice) {
	const normalizedLang = normalizeLang(lang).toLowerCase();
	const languagePrefix = normalizedLang.split("-")[0];
	const voiceLang = voice.lang.toLowerCase();

	return (
		voiceLang === normalizedLang || voiceLang.startsWith(`${languagePrefix}-`)
	);
}

function getVoiceOptions() {
	const matchingVoices = voices.filter(voiceMatchesLanguage);

	return matchingVoices.length > 0 ? matchingVoices : voices;
}

function getVoiceScore(voice: SpeechSynthesisVoice) {
	const normalizedLang = normalizeLang(lang).toLowerCase();
	const languagePrefix = normalizedLang.split("-")[0];
	const voiceLang = voice.lang.toLowerCase();
	let score = 0;

	if (voiceLang === normalizedLang) score += 30;
	if (voiceLang.startsWith(`${languagePrefix}-`)) score += 15;
	if (!voice.localService) score += 8;
	if (NATURAL_VOICE_PATTERN.test(voice.name)) score += 35;
	if (UNNATURAL_VOICE_PATTERN.test(voice.name)) score -= 100;

	return score;
}

function getPreferredVoice(options = getVoiceOptions()) {
	return (
		options.toSorted(
			(left, right) => getVoiceScore(right) - getVoiceScore(left),
		)[0] ?? null
	);
}

function refreshVoices() {
	if (!supported) return;

	voices = window.speechSynthesis.getVoices();
}

function getVoice() {
	return getPreferredVoice();
}

function cancelSpeech() {
	playbackToken += 1;
	window.speechSynthesis.cancel();
	activeUtterance = null;
}

function speakSegment(index: number) {
	if (!supported || segments.length === 0) return;

	cancelSpeech();

	const nextIndex = Math.min(Math.max(index, 0), segments.length - 1);
	const utterance = new SpeechSynthesisUtterance(segments[nextIndex].text);
	const token = playbackToken + 1;
	const voice = getVoice();

	playbackToken = token;
	currentIndex = nextIndex;
	segmentCharIndex = 0;
	activeUtterance = utterance;
	isPlaying = true;
	isPaused = false;
	finished = false;

	utterance.lang = normalizeLang(lang);
	utterance.rate = 1;
	utterance.pitch = 1;
	if (voice) utterance.voice = voice;

	utterance.onboundary = (event) => {
		if (token !== playbackToken) return;
		segmentCharIndex = Math.max(0, event.charIndex);
	};

	utterance.onend = () => {
		if (token !== playbackToken) return;

		activeUtterance = null;
		segmentCharIndex = segments[currentIndex]?.text.length ?? 0;

		if (currentIndex < segments.length - 1) {
			speakSegment(currentIndex + 1);
			return;
		}

		isPlaying = false;
		isPaused = false;
		finished = true;
	};

	utterance.onerror = () => {
		if (token !== playbackToken) return;

		activeUtterance = null;
		isPlaying = false;
		isPaused = false;
	};

	window.speechSynthesis.speak(utterance);
}

function revealPlayer() {
	collectSegments();
	visible = true;
}

function hidePlayer() {
	visible = false;

	if (supported) {
		cancelSpeech();
	}

	isPlaying = false;
	isPaused = false;
	segmentCharIndex = 0;
}

function togglePlayback() {
	if (!supported || segments.length === 0) return;

	if (isPlaying && !isPaused) {
		window.speechSynthesis.pause();
		isPaused = true;
		return;
	}

	if (isPlaying && isPaused) {
		window.speechSynthesis.resume();
		isPaused = false;
		return;
	}

	speakSegment(finished ? 0 : currentIndex);
}

function skipToPrevious() {
	if (segments.length === 0) return;

	const nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;

	if (isPlaying) {
		speakSegment(nextIndex);
		return;
	}

	currentIndex = nextIndex;
	segmentCharIndex = 0;
	finished = false;
}

function skipToNext() {
	if (segments.length === 0) return;

	const nextIndex =
		currentIndex < segments.length - 1 ? currentIndex + 1 : currentIndex;

	if (isPlaying) {
		speakSegment(nextIndex);
		return;
	}

	currentIndex = nextIndex;
	segmentCharIndex = 0;
	finished = currentIndex === segments.length - 1;
}

function getStatusLabel() {
	if (!supported) return "This featrue is being improved...";
	if (segments.length === 0) return "No readable article text found.";
	if (finished) return "Finished";
	if (isPlaying && isPaused) return "Paused";
	if (isPlaying) return "Playing";

	return "Ready";
}

function portal(node: HTMLElement) {
	document.body.appendChild(node);

	return {
		destroy() {
			node.remove();
		},
	};
}

onMount(() => {
	supported =
		"speechSynthesis" in window &&
		typeof SpeechSynthesisUtterance !== "undefined";
	mounted = true;
	collectSegments();
	refreshVoices();

	if (supported) {
		window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
	}

	return () => {
		if (supported) {
			window.speechSynthesis.removeEventListener(
				"voiceschanged",
				refreshVoices,
			);
		}
	};
});

onDestroy(() => {
	if (supported) cancelSpeech();
});
</script>

<div
        use:portal
        class="fixed top-28 z-[80] flex h-10 w-10"
        style="right: max(2rem, calc((100vw - var(--page-width)) / 2 + 2rem));"
        class:hidden={!mounted || visible}
>
    <button
            type="button"
            class="btn-plain scale-animation h-10 w-10 rounded-lg text-[var(--primary)] active:scale-90"
            aria-label="Open podcast player"
            aria-pressed={visible}
            onclick={revealPlayer}
    >
        <Icon
                icon={isPlaying && !isPaused ? "material-symbols:graphic-eq-rounded" : "material-symbols:podcasts-rounded"}
                class="text-[1.35rem]"
        ></Icon>
    </button>
</div>

{#if visible}
    <div
            use:portal
            transition:fly={{ y: 80, duration: 220, opacity: 0.45 }}
            class="pointer-events-none fixed inset-x-3 bottom-3 z-[90] md:inset-x-6 md:bottom-6"
    >
        <section
                class="card-base pointer-events-auto relative mx-auto w-full max-w-3xl !overflow-visible border border-black/10 px-4 pb-4 pt-5 shadow-2xl shadow-black/20 dark:border-white/10 dark:shadow-black/50 md:px-5"
                aria-label="Article podcast player"
        >
            <button
                    type="button"
                    class="btn-card absolute left-1/2 -top-7 z-10 h-10 w-16 -translate-x-1/2 rounded-full border border-black/10 text-black/65 shadow-lg shadow-black/10 active:scale-95 dark:border-white/10 dark:text-white/65 dark:shadow-black/40"
                    aria-label="Hide podcast player"
                    onclick={hidePlayer}
            >
                <Icon icon="material-symbols:keyboard-arrow-down-rounded" class="text-[1.55rem]"></Icon>
            </button>

            <div
                    class="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
                    role="progressbar"
                    aria-label="Article playback progress"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={Math.round(progressRatio * 100)}
            >
                <div
                        class="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300 ease-out"
                        style={`width: ${progressPercent}`}
                ></div>
            </div>

            <div class="mt-3 flex items-center gap-3">
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                        <p class="truncate text-sm font-bold text-black/80 dark:text-white/80">
                            {title}
                        </p>
                        <span class="hidden shrink-0 rounded-md bg-[var(--btn-regular-bg)] px-2 py-0.5 text-xs font-bold text-[var(--btn-content)] sm:inline-flex">
                            {statusLabel}
                        </span>
                        <span class="shrink-0 text-xs font-bold text-black/35 dark:text-white/35 sm:hidden">
                            {segments.length > 0 ? `${currentIndex + 1} / ${segments.length}` : "0 / 0"}
                        </span>
                    </div>
                    <p class="mt-1 line-clamp-1 text-sm text-black/45 dark:text-white/45">
                        {activeSegment?.text ?? "Open this on an article with readable text."}
                    </p>
                </div>

                <div class="hidden items-center gap-1 md:flex">
                    <button
                            type="button"
                            class="btn-plain h-10 w-10 rounded-lg active:scale-95"
                            aria-label="Previous paragraph"
                            disabled={segments.length === 0 || currentIndex === 0}
                            onclick={skipToPrevious}
                    >
                        <Icon icon="material-symbols:skip-previous-rounded" class="text-[1.5rem]"></Icon>
                    </button>
                    <button
                            type="button"
                            class="btn-plain h-10 w-10 rounded-lg active:scale-95"
                            aria-label="Next paragraph"
                            disabled={segments.length === 0 || currentIndex >= segments.length - 1}
                            onclick={skipToNext}
                    >
                        <Icon icon="material-symbols:skip-next-rounded" class="text-[1.5rem]"></Icon>
                    </button>
                </div>

                <div class="hidden w-20 shrink-0 text-right text-xs font-bold text-black/35 dark:text-white/35 sm:block">
                    {segments.length > 0 ? `${currentIndex + 1} / ${segments.length}` : "0 / 0"}
                </div>

                <button
                        type="button"
                        class="btn-regular h-12 w-12 shrink-0 rounded-xl active:scale-95"
                        aria-label={isPlaying && !isPaused ? "Pause article" : "Play article"}
                        disabled={!supported || segments.length === 0}
                        onclick={togglePlayback}
                >
                    <Icon
                            icon={isPlaying && !isPaused ? "material-symbols:pause-rounded" : "material-symbols:play-arrow-rounded"}
                            class="text-[1.9rem]"
                    ></Icon>
                </button>
            </div>
        </section>
    </div>
{/if}
