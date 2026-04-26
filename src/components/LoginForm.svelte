<script lang="ts">
import Icon from "@iconify/svelte";
import type { User } from "@supabase/supabase-js";
import { onMount } from "svelte";
import { showToast } from "@/utils/toast";
import { initializeSupabaseAuth, supabase } from "@/lib/supabaseClient";

let email = "";
let password = "";
let loading = false;
let user: User | null = null;
let mode: "signIn" | "signUp" = "signIn";

async function loadCurrentUser() {
	const { error: initializeError } = await initializeSupabaseAuth();
	if (initializeError) {
		showToast(initializeError.message, "error");
	}

	const { data } = await supabase.auth.getSession();
	user = data.session?.user ?? null;
}

onMount(() => {
	const {
		data: { subscription },
	} = supabase.auth.onAuthStateChange((_event, session) => {
		user = session?.user ?? null;
	});

	void loadCurrentUser();

	return () => subscription.unsubscribe();
});

async function handleSubmit() {
	if (!email || !password) {
		showToast("Please enter your email and password.", "error");
		return;
	}

	if (password.length < 6) {
		showToast("Password must be at least 6 characters.", "error");
		return;
	}

	loading = true;

	try {
		const authRequest =
			mode === "signIn"
				? supabase.auth.signInWithPassword({ email, password })
				: supabase.auth.signUp({
						email,
						password,
						options: {
							emailRedirectTo: `${window.location.origin}/login/`,
						},
					});

		const { data, error } = await authRequest;

		if (error) throw error;

		user = data.user;
		showToast(
			mode === "signIn"
				? "Signed in successfully."
				: data.session
					? "Account created and signed in."
					: "Confirmation email sent. Please check your inbox.",
			"success",
		);
	} catch (error) {
		showToast(
			error instanceof Error
				? error.message
				: "Authentication failed. Please try again later.",
			"error",
		);
	} finally {
		loading = false;
	}
}

async function handleGitHubSignIn() {
	loading = true;

	try {
		const { error } = await supabase.auth.signInWithOAuth({
			provider: "github",
			options: {
				redirectTo: `${window.location.origin}/login/`,
			},
		});

		if (error) throw error;
	} catch (error) {
		showToast(
			error instanceof Error
				? error.message
				: "GitHub sign-in failed. Please try again later.",
			"error",
		);
		loading = false;
	}
}

async function handleWalletSignIn(chain: "ethereum" | "solana") {
	loading = true;

	try {
		const { data, error } =
			chain === "ethereum"
				? await supabase.auth.signInWithWeb3({
						chain: "ethereum",
						statement: `Sign in to ${window.location.host}`,
						options: {
							url: window.location.href,
						},
					})
				: await supabase.auth.signInWithWeb3({
						chain: "solana",
						statement: `Sign in to ${window.location.host}`,
						options: {
							url: window.location.href,
						},
					});

		if (error) throw error;

		user = data.user;
		showToast(
			`Signed in with ${chain === "ethereum" ? "Ethereum" : "Solana"}.`,
			"success",
		);
	} catch (error) {
		showToast(
			error instanceof Error
				? error.message
				: `${chain === "ethereum" ? "Ethereum" : "Solana"} wallet sign-in failed.`,
			"error",
		);
	} finally {
		loading = false;
	}
}

async function handlePasswordReset() {
	showToast(
		"Password reset is currently under development. Please contact carbon1024@foxmail.com for account recovery assistance.",
		"success",
	);
}

async function handleSignOut() {
	loading = true;

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
		loading = false;
	}
}
</script>

<div class="card-base px-8 py-8 md:px-10 md:py-10">
    <div class="mb-8 flex items-center gap-4">
        <div class="meta-icon !mr-0">
            <Icon icon="material-symbols:lock-open-outline-rounded" class="text-[1.25rem]"></Icon>
        </div>
        <div>
            <h1 class="text-2xl font-bold text-90">Login</h1>
            <p class="mt-1 text-sm text-50">Sign in with your email or GitHub account.</p>
        </div>
    </div>

    {#if user}
        <div class="rounded-2xl bg-[var(--btn-plain-bg-hover)] px-5 py-4">
            <p class="text-sm font-medium text-75">You are signed in</p>
            <p class="mt-1 break-all text-sm text-50">{user.email}</p>
        </div>

        <button
                type="button"
                class="btn-regular mt-6 h-11 w-full rounded-xl font-bold active:scale-95"
                disabled={loading}
                onclick={handleSignOut}
        >
            {loading ? "Working..." : "Sign out"}
        </button>
    {:else}
        <div class="space-y-4">
            <button
                    type="button"
                    class="btn-regular h-14 w-full rounded-xl font-bold active:scale-95"
                    disabled={loading}
                    onclick={handleGitHubSignIn}
            >
                <Icon icon="fa6-brands:github" class="mr-2 text-[1.1rem]"></Icon>
                {loading ? "Working..." : "Continue with GitHub"}
            </button>

            <button
                    type="button"
                    class="btn-regular h-14 w-full rounded-xl font-bold active:scale-95"
                    disabled={loading}
                    onclick={() => void handleWalletSignIn("ethereum")}
            >
                <Icon icon="fa6-brands:ethereum" class="mr-2 text-[1.1rem]"></Icon>
                {loading ? "Working..." : "Continue with Ethereum"}
            </button>

            <button
                    type="button"
                    class="btn-regular h-14 w-full rounded-xl font-bold active:scale-95"
                    disabled={loading}
                    onclick={() => void handleWalletSignIn("solana")}
            >
                <Icon icon="material-symbols:account-balance-wallet-outline-rounded" class="mr-2 text-[1.1rem]"></Icon>
                {loading ? "Working..." : "Continue with Solana"}
            </button>
        </div>

        <div class="my-8 flex items-center gap-4">
            <div class="h-px flex-1 bg-[var(--line-color)]"></div>
            <span class="text-xs font-medium uppercase tracking-wider text-30">or</span>
            <div class="h-px flex-1 bg-[var(--line-color)]"></div>
        </div>

        <form
                class="space-y-5"
                onsubmit={(event) => {
                    event.preventDefault();
                    void handleSubmit();
                }}
        >
            <label class="block">
                <span class="mb-2 block text-sm font-medium text-75">Email</span>
                <input
                        class="h-12 w-full rounded-xl bg-black/[0.04] px-4 text-sm text-75 outline-0 transition
                        placeholder:text-black/30 focus:bg-black/[0.06]
                        dark:bg-white/5 dark:placeholder:text-white/30 dark:focus:bg-white/10"
                        type="email"
                        autocomplete="email"
                        placeholder="you@example.com"
                        bind:value={email}
                />
            </label>

            <label class="block">
                <span class="mb-2 block text-sm font-medium text-75">Password</span>
                <input
                        class="h-12 w-full rounded-xl bg-black/[0.04] px-4 text-sm text-75 outline-0 transition
                        placeholder:text-black/30 focus:bg-black/[0.06]
                        dark:bg-white/5 dark:placeholder:text-white/30 dark:focus:bg-white/10"
                        type="password"
                        autocomplete={mode === "signIn" ? "current-password" : "new-password"}
                        placeholder="At least 6 characters"
                        bind:value={password}
                />
            </label>

            <button
                    type="submit"
                    class="btn-regular h-12 w-full rounded-xl font-bold active:scale-95"
                    disabled={loading}
            >
                {loading ? "Working..." : mode === "signIn" ? "Sign in" : "Create account"}
            </button>
        </form>

        <div class="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <button
                    type="button"
                    class="link text-[var(--primary)]"
                    onclick={() => {
                        mode = mode === "signIn" ? "signUp" : "signIn";
                    }}
            >
                {mode === "signIn" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>

            <button
                    type="button"
                    class="link text-[var(--primary)]"
                    disabled={loading}
                    onclick={handlePasswordReset}
            >
                Forgot password?
            </button>
        </div>
    {/if}
</div>
