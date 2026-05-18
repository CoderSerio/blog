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

let loadingProvider: "github" | "google" | "signOut" | null = null;
let user: User | null = null;
let open = false;
let dialog: HTMLDivElement;

async function loadCurrentUser() {
	if (!supabase) return;

	const { error: initializeError } = await initializeSupabaseAuth();
	if (initializeError) {
		showToast(initializeError.message, "error");
	}

	const { data } = await supabase.auth.getSession();
	user = data.session?.user ?? null;
}

function getRedirectUrl() {
	return `${window.location.origin}${window.location.pathname}${window.location.search}`;
}

function getProviderName(provider: "github" | "google") {
	return provider === "github" ? "GitHub" : "Google";
}

function openModal() {
	open = true;
	document.body.style.overflow = "hidden";
	setTimeout(() => dialog?.focus(), 0);
}

function closeModal() {
	open = false;
	loadingProvider = null;
	document.body.style.overflow = "";
}

function handleOpenEvent() {
	openModal();
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === "Escape") {
		closeModal();
	}
}

onMount(() => {
	if (!isSupabaseConfigured || !supabase) {
		return;
	}

	const {
		data: { subscription },
	} = supabase.auth.onAuthStateChange((_event, session) => {
		user = session?.user ?? null;
		if (session?.user) {
			closeModal();
		}
	});

	window.addEventListener("blog-auth-open", handleOpenEvent);
	window.addEventListener("keydown", handleKeydown);
	void loadCurrentUser();

	return () => {
		subscription.unsubscribe();
		window.removeEventListener("blog-auth-open", handleOpenEvent);
		window.removeEventListener("keydown", handleKeydown);
		document.body.style.overflow = "";
	};
});

async function handleOAuthSignIn(provider: "github" | "google") {
	if (!supabase) {
		showToast("Authentication is not configured.", "error");
		return;
	}

	loadingProvider = provider;

	try {
		const { data, error } = await supabase.auth.signInWithOAuth({
			provider,
			options: {
				redirectTo: getRedirectUrl(),
				skipBrowserRedirect: true,
			},
		});

		if (error) throw error;

		if (!data.url) {
			throw new Error(`${getProviderName(provider)} sign-in is not available.`);
		}

		if (provider === "google") {
			const response = await fetch(data.url, { redirect: "manual" });
			if (response.status >= 400) {
				const fallbackMessage =
					"Google sign-in is not enabled in Supabase.";
				try {
					const payload = (await response.json()) as { msg?: string };
					throw new Error(payload.msg ?? fallbackMessage);
				} catch (error) {
					if (error instanceof Error) {
						throw error;
					}
					throw new Error(fallbackMessage);
				}
			}
		}

		window.location.assign(data.url);

		window.setTimeout(() => {
			loadingProvider = null;
		}, 8000);
	} catch (error) {
		showToast(
			error instanceof Error
				? error.message
				: `${getProviderName(provider)} sign-in failed. Please try again later.`,
			"error",
		);
		loadingProvider = null;
	}
}

// Web3 wallet sign-in is temporarily disabled. Keep the implementation out of
// the active UI until wallet login is needed again.
// async function handleWalletSignIn(chain: "ethereum" | "solana") {
// 	if (!supabase) {
// 		showToast("Authentication is not configured.", "error");
// 		return;
// 	}
//
// 	loading = true;
//
// 	try {
// 		const { data, error } =
// 			chain === "ethereum"
// 				? await supabase.auth.signInWithWeb3({
// 						chain: "ethereum",
// 						statement: `Sign in to ${window.location.host}`,
// 						options: {
// 							url: window.location.href,
// 						},
// 					})
// 				: await supabase.auth.signInWithWeb3({
// 						chain: "solana",
// 						statement: `Sign in to ${window.location.host}`,
// 						options: {
// 							url: window.location.href,
// 						},
// 					});
//
// 		if (error) throw error;
//
// 		user = data.user;
// 		showToast(
// 			`Signed in with ${chain === "ethereum" ? "Ethereum" : "Solana"}.`,
// 			"success",
// 		);
// 	} catch (error) {
// 		showToast(
// 			error instanceof Error
// 				? error.message
// 				: `${chain === "ethereum" ? "Ethereum" : "Solana"} wallet sign-in failed.`,
// 			"error",
// 		);
// 	} finally {
// 		loading = false;
// 	}
// }

async function handleSignOut() {
	if (!supabase) return;

	loadingProvider = "signOut";

	try {
		const { error } = await supabase.auth.signOut();

		if (error) throw error;

		user = null;
		showToast("Signed out successfully.", "success");
	} catch (error) {
		showToast(
			error instanceof Error ? error.message : "Failed to sign out.",
			"error",
		);
	} finally {
		loadingProvider = null;
	}
}
</script>

{#if open}
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) {
				closeModal();
			}
		}}
	>
		<div
			class="card-base w-full max-w-[28rem] px-6 py-6 shadow-2xl shadow-black/20 outline-none md:px-8 md:py-8 dark:shadow-black/50"
			role="dialog"
			aria-modal="true"
			aria-labelledby="auth-dialog-title"
			tabindex="-1"
			bind:this={dialog}
		>
			<div class="mb-7 flex items-start justify-between gap-4">
				<div class="flex items-center gap-4">
					<div class="meta-icon !mr-0">
						<Icon icon="material-symbols:lock-open-outline-rounded" class="text-[1.25rem]"></Icon>
					</div>
					<div>
						<h1 id="auth-dialog-title" class="text-xl font-bold text-90">Sign in</h1>
						<p class="mt-1 text-sm text-50">Continue with GitHub or Google.</p>
					</div>
				</div>
				<button
					type="button"
					class="btn-plain h-10 w-10 shrink-0 rounded-lg active:scale-95"
					aria-label="Close sign in dialog"
					onclick={closeModal}
				>
					<Icon icon="material-symbols:close-rounded" class="text-[1.25rem]"></Icon>
				</button>
			</div>

			{#if !isSupabaseConfigured}
				<div class="rounded-xl bg-[var(--btn-plain-bg-hover)] px-5 py-4">
					<p class="text-sm font-medium text-75">Authentication is not configured</p>
					<p class="mt-1 text-sm text-50">Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY to enable sign in.</p>
				</div>
			{:else if user}
				<div class="rounded-xl bg-[var(--btn-plain-bg-hover)] px-5 py-4">
					<p class="text-sm font-medium text-75">You are signed in</p>
					<p class="mt-1 break-all text-sm text-50">{user.email ?? user.id}</p>
				</div>

				<button
					type="button"
					class="btn-regular mt-6 h-11 w-full rounded-xl font-bold active:scale-95"
					disabled={loadingProvider !== null}
					onclick={handleSignOut}
				>
					{loadingProvider === "signOut" ? "Working..." : "Sign out"}
				</button>
			{:else}
				<div class="space-y-3">
					<button
						type="button"
						class="btn-regular h-12 w-full rounded-xl font-bold active:scale-95"
						disabled={loadingProvider !== null}
						onclick={() => void handleOAuthSignIn("github")}
					>
						<Icon icon="fa6-brands:github" class="mr-2 text-[1.1rem]"></Icon>
						{loadingProvider === "github" ? "Opening GitHub..." : "Continue with GitHub"}
					</button>

					<button
						type="button"
						class="btn-regular h-12 w-full rounded-xl font-bold active:scale-95"
						disabled={loadingProvider !== null}
						onclick={() => void handleOAuthSignIn("google")}
					>
						<Icon icon="fa6-brands:google" class="mr-2 text-[1.1rem]"></Icon>
						{loadingProvider === "google" ? "Opening Google..." : "Continue with Google"}
					</button>

					<!-- Web3 wallet buttons are intentionally hidden for now.
					<button type="button" onclick={() => void handleWalletSignIn("ethereum")}>
						Continue with Ethereum
					</button>
					<button type="button" onclick={() => void handleWalletSignIn("solana")}>
						Continue with Solana
					</button>
					-->
				</div>
			{/if}
		</div>
	</div>
{/if}
