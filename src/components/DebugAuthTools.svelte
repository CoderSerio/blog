<script lang="ts">
import Icon from "@iconify/svelte";
import { onMount } from "svelte";
import { supabase } from "@/lib/supabaseClient";
import { showToast } from "@/utils/toast";

let enabled = false;
let loading = false;
const supabaseStoragePrefix = "sb-wfpgsjigghsffzujnuhh-auth-token";

function isLocalhost(hostname: string) {
	return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

onMount(() => {
	const params = new URLSearchParams(window.location.search);
	enabled = isLocalhost(window.location.hostname) && params.get("debug") === "1";
});

async function handleSignOut() {
	loading = true;

	try {
		const { error } = await supabase.auth.signOut();

		if (error) throw error;

		showToast("Debug sign out completed.", "success");
	} catch (error) {
		showToast(
			error instanceof Error ? error.message : "Debug sign out failed.",
			"error",
		);
	} finally {
		loading = false;
	}
}

function handleClearAuthStorage() {
	const keysToRemove = Object.keys(localStorage).filter((key) =>
		key.startsWith(supabaseStoragePrefix),
	);

	for (const key of keysToRemove) {
		localStorage.removeItem(key);
	}

	showToast(`Cleared ${keysToRemove.length} Supabase auth storage item(s).`, "success");
}
</script>

{#if enabled}
    <div class="fixed bottom-4 right-4 z-[2147483646] flex flex-col gap-2 rounded-2xl border border-white/10 bg-[oklch(0.23_0.015_var(--hue))] p-2 shadow-2xl shadow-black/50">
        <button
                type="button"
                class="btn-regular h-10 rounded-xl px-4 font-bold active:scale-95"
                disabled={loading}
                onclick={handleSignOut}
        >
            <Icon icon="material-symbols:logout-rounded" class="mr-2 text-[1.1rem]"></Icon>
            {loading ? "Signing out..." : "Debug sign out"}
        </button>
        <button
                type="button"
                class="btn-regular h-10 rounded-xl px-4 font-bold active:scale-95"
                onclick={handleClearAuthStorage}
        >
            <Icon icon="material-symbols:delete-outline-rounded" class="mr-2 text-[1.1rem]"></Icon>
            Clear auth storage
        </button>
    </div>
{/if}
