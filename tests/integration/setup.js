// Integration test harness — shared admin client + fixture helpers.
//
// SAFETY: these tests use the Supabase service_role key, which bypasses RLS and
// can create/delete auth users. They MUST run only against the local Supabase
// Docker instance. The guardrail below refuses to run against anything that
// isn't localhost — this is the line of defense against accidentally mutating
// production (the app's .env.local points at the remote project).
//
// This file is BOTH the Vitest `setupFiles` entry and the shared helper module
// imported by the test files. It deliberately defines NO global beforeAll/
// afterAll hooks — each test file owns and tears down its own fixtures.

import WS from 'ws';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

// supabase-js initializes a Realtime client inside createClient(), which needs a
// global WebSocket. Node 22+ has one natively; Node < 22 (e.g. CI's Node 20) does
// not, so createClient() throws before any test runs. Polyfill it from `ws` when
// absent (a no-op on Node 22+). As a setupFiles entry this runs before any test
// module — including src/supabase.js's module-level createClient — is imported,
// and before the adminClient createClient() call below.
if (!globalThis.WebSocket) globalThis.WebSocket = WS;

// ─── Env resolution + localhost guardrail ───────────────────────────────────
// URL / anon key come from the `env:` block in vitest.integration.config.js so
// they are present before src/supabase.js binds its module-level client.
// The service_role key comes from the environment (.env.local locally, CI
// secret in Actions), with the well-known deterministic local key as fallback.
const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const LOCAL_URLS = ['http://127.0.0.1:54321', 'http://localhost:54321'];
if (!LOCAL_URLS.includes(url)) {
  throw new Error(
    `Integration tests refuse to run against a non-local Supabase URL.\n` +
      `  Resolved VITE_SUPABASE_URL: ${url ?? '(unset)'}\n` +
      `  Expected one of: ${LOCAL_URLS.join(', ')}\n` +
      `  Start local Supabase with \`supabase start\` and run \`npm run test:integration\`.`,
  );
}

if (!anonKey || !svcKey) {
  throw new Error(
    'Integration tests need VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY. ' +
      'These are injected by vitest.integration.config.js (local) or CI secrets.',
  );
}

// Admin client — bypasses RLS. Used ONLY for fixture setup/teardown, never to
// assert policy behavior (assertions use a fresh anon-key client).
export const adminClient = createClient(url, svcKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const anonUrl = url;
export const anonPublicKey = anonKey;

// ─── Unique identity helpers ─────────────────────────────────────────────────
// Unique per call so the RLS join hack (profiles.email = licensees.name) never
// collides across tests, and no test leaves data that another test sees.
export function uniqueEmail(prefix = 'user') {
  return `${prefix}-${randomUUID()}@test.local`;
}

export function uniqueCompanyId() {
  return `co_${randomUUID().slice(0, 8)}`;
}

const DEFAULT_PASSWORD = 'test-password-123!';

// ─── Fixture creation ─────────────────────────────────────────────────────────

// Create an auth user (profile row auto-created by the on_auth_user_created
// trigger, is_super_admin=false) and return a client signed in as that user.
export async function createTestSession(email, password = DEFAULT_PASSWORD) {
  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) throw new Error(`createUser failed: ${createErr.message}`);

  const client = createClient(url, anonKey);
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`signIn failed: ${signInErr.message}`);

  return { client, userId: created.user.id };
}

// Flip a profile to super-admin (admin client bypasses RLS).
export async function makeSuperAdmin(userId) {
  const { error } = await adminClient
    .from('profiles')
    .update({ is_super_admin: true })
    .eq('id', userId);
  if (error) throw new Error(`makeSuperAdmin failed: ${error.message}`);
}

// A licensee's `name` MUST equal the user's email — that is the temp RLS join
// key (profiles.email = licensees.name) until a real licensee_id FK is added.
export async function createLicenseeFor(email) {
  const { data, error } = await adminClient
    .from('licensees')
    .insert({ name: email })
    .select('id')
    .single();
  if (error) throw new Error(`createLicensee failed: ${error.message}`);
  return data.id;
}

export async function createCompany({ id, name = 'Test Co', config = {} } = {}) {
  const companyId = id ?? uniqueCompanyId();
  const { data, error } = await adminClient
    .from('companies')
    .insert({ id: companyId, name, config })
    .select('id')
    .single();
  if (error) throw new Error(`createCompany failed: ${error.message}`);
  return data.id;
}

export async function assignCompany(licenseeId, companyId, role = 'editor') {
  const { error } = await adminClient
    .from('licensee_companies')
    .insert({ licensee_id: licenseeId, company_id: companyId, role });
  if (error) throw new Error(`assignCompany failed: ${error.message}`);
}

// Full chain: user + session, licensee named = email, company, assignment.
// Returns everything a test needs plus the credentials for re-sign-in.
export async function provisionLicenseeWithCompany({
  role = 'editor',
  companyConfig = {},
  companyName = 'Test Co',
  emailPrefix = 'licensee',
} = {}) {
  const email = uniqueEmail(emailPrefix);
  const password = DEFAULT_PASSWORD;
  const { client, userId } = await createTestSession(email, password);
  const licenseeId = await createLicenseeFor(email);
  const companyId = await createCompany({ name: companyName, config: companyConfig });
  await assignCompany(licenseeId, companyId, role);
  return { client, userId, email, password, licenseeId, companyId };
}

// ─── Teardown (no-throw on missing rows) ─────────────────────────────────────
// Order: company → licensee → user. licensee_companies cascades from either
// side; deleting the auth user cascades its profiles row.

export async function cleanupCompany(companyId) {
  if (!companyId) return;
  await adminClient.from('companies').delete().eq('id', companyId);
}

export async function cleanupLicensee(licenseeId) {
  if (!licenseeId) return;
  await adminClient.from('licensees').delete().eq('id', licenseeId);
}

export async function cleanupUser(email) {
  if (!email) return;
  const { data } = await adminClient.auth.admin.listUsers();
  const user = data?.users?.find((u) => u.email === email);
  if (user) await adminClient.auth.admin.deleteUser(user.id);
}

// Tear down a full provisionLicenseeWithCompany() result.
export async function teardownAll(fixture) {
  if (!fixture) return;
  await fixture.client?.auth?.signOut?.().catch(() => {});
  await cleanupCompany(fixture.companyId);
  await cleanupLicensee(fixture.licenseeId);
  await cleanupUser(fixture.email);
}
