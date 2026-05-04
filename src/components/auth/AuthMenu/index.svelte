<script lang="ts">
import Icon from "@iconify/svelte";
import type { User } from "@supabase/supabase-js";
import { onMount } from "svelte";
import {
	initializeSupabaseAuth,
	isSupabaseConfigured,
	supabase,
} from "@/lib/supabaseClient";
import { showToast } from "@/utils/toast";
import { url } from "@/utils/url-utils";

let user: User | null = null;
let open = false;
let loading = false;
let mounted = false;
let root: HTMLDivElement;

async function loadCurrentUser() {
	if (!supabase) return;

	await initializeSupabaseAuth();
	const { data } = await supabase.auth.getSession();
	user = data.session?.user ?? null;
}

function getUserLabel() {
	if (!user) return "";

	const identityData = user.identities?.[0]?.identity_data;
	const email = user.email ?? identityData?.email;
	const walletAddress =
		identityData?.wallet_address ??
		identityData?.address ??
		identityData?.sub ??
		user.user_metadata?.wallet_address ??
		user.user_metadata?.address;

	return email ?? walletAddress ?? user.id;
}

function getShortUserLabel() {
	const label = getUserLabel();

	if (!label) return "Account";
	if (label.includes("@")) return label;
	if (label.length <= 16) return label;

	return `${label.slice(0, 6)}...${label.slice(-4)}`;
}

function handleDocumentClick(event: MouseEvent) {
	if (!root?.contains(event.target as Node)) {
		open = false;
	}
}

async function handleSignOut() {
	if (!supabase) return;

	loading = true;

	try {
		const { error } = await supabase.auth.signOut();

		if (error) throw error;

		open = false;
		user = null;
		showToast("Signed out successfully.", "success");
	} catch (error) {
		showToast(
			error instanceof Error ? error.message : "Failed to sign out.",
			"error",
		);
	} finally {
		loading = false;
	}
}

onMount(() => {
	if (!isSupabaseConfigured || !supabase) {
		document
			.getElementById("navbar-auth-fallback")
			?.setAttribute("style", "display: none");
		window.dispatchEvent(new CustomEvent("navbar-auth-ready"));
		return;
	}

	mounted = true;
	document
		.getElementById("navbar-auth-fallback")
		?.setAttribute("style", "display: none");
	window.dispatchEvent(new CustomEvent("navbar-auth-ready"));

	const {
		data: { subscription },
	} = supabase.auth.onAuthStateChange((_event, session) => {
		user = session?.user ?? null;
	});

	document.addEventListener("click", handleDocumentClick);
	void loadCurrentUser();

	return () => {
		subscription.unsubscribe();
		document.removeEventListener("click", handleDocumentClick);
	};
});
</script>

<div class="relative" bind:this={root} class:hidden={!mounted}>
    {#if user}
        <button
                type="button"
                class="btn-plain scale-animation h-11 rounded-lg px-3 font-bold active:scale-95"
                aria-label="Account menu"
                aria-expanded={open}
                onclick={() => {
                    open = !open;
                }}
        >
            <Icon icon="material-symbols:account-circle-outline-rounded" class="mr-1.5 text-[1.25rem]"></Icon>
            <span class="hidden max-w-28 truncate md:block">{getShortUserLabel()}</span>
        </button>

        {#if open}
            <div
                    class="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-black/10 bg-white p-2 shadow-2xl shadow-black/20
                    dark:border-white/10 dark:bg-[oklch(0.23_0.015_var(--hue))] dark:shadow-black/50"
            >
                <div class="px-3 py-2">
                    <p class="text-xs font-medium uppercase tracking-wider text-black/40 dark:text-white/40">Signed in as</p>
                    <p class="mt-1 break-all text-sm font-medium text-black/75 dark:text-white/75">{getUserLabel()}</p>
                </div>

                <button
                        type="button"
                        class="btn-plain mt-1 h-10 w-full justify-start rounded-xl px-3 font-bold active:scale-95"
                        disabled={loading}
                        onclick={handleSignOut}
                >
                    <Icon icon="material-symbols:logout-rounded" class="mr-2 text-[1.1rem]"></Icon>
                    {loading ? "Signing out..." : "Sign out"}
                </button>
            </div>
        {/if}
    {:else}
        <a href={url("/login/")} class="btn-plain scale-animation flex h-11 items-center rounded-lg px-4 font-bold active:scale-95">
            Sign In
        </a>
    {/if}
</div>
