import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

type BrowserGlobalWithSupabase = typeof globalThis & {
	__blogSupabaseClient?: SupabaseClient | null;
};

function createSupabaseBrowserClient() {
	if (!isSupabaseConfigured) {
		return null;
	}

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

function getBrowserSupabaseClient() {
	if (!browserGlobal.__blogSupabaseClient) {
		browserGlobal.__blogSupabaseClient = createSupabaseBrowserClient();
	}

	return browserGlobal.__blogSupabaseClient;
}

export const supabase =
	typeof window === "undefined"
		? createSupabaseBrowserClient()
		: getBrowserSupabaseClient();

export async function initializeSupabaseAuth() {
	return await supabase?.auth.initialize();
}
