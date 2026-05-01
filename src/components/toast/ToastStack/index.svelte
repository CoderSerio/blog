<script lang="ts">
import Icon from "@iconify/svelte";
import { fly } from "svelte/transition";
import { dismissToast, toasts } from "@/utils/toast";

function getToastClass(type: "success" | "error") {
	const base =
		"pointer-events-auto rounded-2xl border bg-white px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur dark:bg-[oklch(0.23_0.015_var(--hue))] dark:shadow-black/50";
	const tone =
		type === "success"
			? "border-[oklch(0.70_0.14_var(--hue)_/_0.35)] dark:border-[oklch(0.75_0.14_var(--hue)_/_0.35)]"
			: "border-red-400/40 dark:border-red-400/30";

	return `${base} ${tone}`;
}

function getIconClass(type: "success" | "error") {
	const base =
		"mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg";
	const tone =
		type === "success"
			? "bg-[oklch(0.70_0.14_var(--hue)_/_0.14)] text-[oklch(0.55_0.14_var(--hue))] dark:bg-[oklch(0.75_0.14_var(--hue)_/_0.14)] dark:text-[var(--primary)]"
			: "bg-red-500/10 text-red-600 dark:bg-red-400/10 dark:text-red-300";

	return `${base} ${tone}`;
}

function getMessageClass(type: "success" | "error") {
	const base = "min-w-0 flex-1 text-sm leading-6";
	const tone =
		type === "success"
			? "text-black/75 dark:text-white/75"
			: "text-red-700 dark:text-red-200";

	return `${base} ${tone}`;
}

function portal(node: HTMLElement) {
	document.body.appendChild(node);

	return {
		destroy() {
			node.remove();
		},
	};
}
</script>

<div
        use:portal
        class="pointer-events-none fixed inset-x-4 top-4 flex flex-col gap-3 md:inset-x-auto md:right-6 md:top-6 md:w-96"
        style="z-index: 2147483647;"
        aria-live="polite"
        aria-atomic="true"
>
    {#each $toasts as toast (toast.id)}
        <div
                transition:fly={{ x: 64, duration: 180 }}
                class={getToastClass(toast.type)}
        >
            <div class="flex items-start gap-3">
                <div class={getIconClass(toast.type)}>
                    <Icon
                            icon={toast.type === "success" ? "material-symbols:check-rounded" : "material-symbols:error-outline-rounded"}
                            class="text-[1.1rem]"
                    ></Icon>
                </div>

                <p class={getMessageClass(toast.type)}>
                    {toast.message}
                </p>

                <button
                        type="button"
                        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-black/45 transition hover:bg-black/5 hover:text-black/70 active:scale-90 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/75"
                        aria-label="Dismiss notification"
                        onclick={() => dismissToast(toast.id)}
                >
                    <Icon icon="material-symbols:close-rounded" class="text-[1rem]"></Icon>
                </button>
            </div>
        </div>
    {/each}
</div>
