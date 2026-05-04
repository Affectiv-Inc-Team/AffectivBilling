// localStorage shim — replace with real Supabase client when credentials are available
const KEY = "intrinsic_config";

export async function loadConfig() {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function saveConfig(config) {
  localStorage.setItem(KEY, JSON.stringify(config));
  return true;
}

// Stub so any stray import of `supabase` doesn't crash
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
};
