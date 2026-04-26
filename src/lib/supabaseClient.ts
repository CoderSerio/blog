import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
	throw new Error("Missing Supabase public environment variables.");
}

type BrowserGlobalWithSupabase = typeof globalThis & {
	__blogSupabaseClient?: SupabaseClient;
};

function createSupabaseBrowserClient() {
	return createClient(supabaseUrl, supabaseKey, {
		auth: {
			autoRefreshToken: true,
			detectSessionInUrl: true,
			flowType: "pkce",
			persistSession: true,
		},
	});
}

const browserGlobal = globalThis as BrowserGlobalWithSupabase;

export const supabase =
	typeof window === "undefined"
		? createSupabaseBrowserClient()
		: (browserGlobal.__blogSupabaseClient ??= createSupabaseBrowserClient());

export async function initializeSupabaseAuth() {
	return await supabase.auth.initialize();
}
