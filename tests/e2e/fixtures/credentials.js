// Shared E2E identity. global-setup.js provisions exactly this user (as a
// super-admin, so it can load/save the unassigned seed company despite the
// Phase 3 RLS gap), and global-teardown.js removes it. The specs sign in with
// these constants through the real login form.

export const E2E_EMAIL = 'e2e-user@test.local';
export const E2E_PASSWORD = 'e2e-password-123!';

// Local Supabase — the only place E2E tests are allowed to run.
export const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
