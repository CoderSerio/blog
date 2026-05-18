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

let user: User | null = null;
let open = false;
let loading = false;
let mounted = false;
let userRole: "owner" | "admin" | "editor" | "user" | null = null;
let root: HTMLDivElement;

async function loadCurrentUser() {
	if (!supabase) return;

	await initializeSupabaseAuth();
	const { data } = await supabase.auth.getSession();
	user = data.session?.user ?? null;
	await loadUserRole();
}

async function loadUserRole() {
	if (!supabase || !user) {
		userRole = null;
		return;
	}

	const { data, error } = await supabase
		.from("user_roles")
		.select("role")
		.eq("user_id", user.id)
		.maybeSingle();

	if (error) {
		userRole = null;
		return;
	}

	userRole = data?.role ?? "user";
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
		userRole = null;
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

function openAuthDialog() {
	window.dispatchEvent(new CustomEvent("blog-auth-open"));
}

function getRoleLabel() {
	switch (userRole) {
		case "owner":
			return "Owner";
		case "admin":
			return "Admin";
		case "editor":
			return "Editor";
		case "user":
			return "User";
		default:
			return "User";
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
		void loadUserRole();
	});

	document.addEventListener("click", handleDocumentClick);
	void loadCurrentUser();

	return () => {
		subscription.unsubscribe();
		document.removeEventListener("click", handleDocumentClick);
	};
});
</script>

<div
        class="relative"
        bind:this={root}
        class:hidden={!mounted}
        onmouseenter={() => {
            if (user) open = true;
        }}
>
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

                <div class="mx-3 mb-2 flex items-center justify-between rounded-xl bg-black/[0.04] px-3 py-2 dark:bg-white/[0.06]">
                    <span class="text-xs font-medium uppercase tracking-wider text-black/40 dark:text-white/40">Role</span>
                    <span class="rounded-lg bg-[var(--primary)]/10 px-2 py-1 text-xs font-bold text-[var(--primary)]">
                        {getRoleLabel()}
                    </span>
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
        <button
                type="button"
                class="btn-plain scale-animation flex h-11 items-center rounded-lg px-4 font-bold active:scale-95"
                onclick={openAuthDialog}
        >
            Sign In
        </button>
    {/if}
</div>
