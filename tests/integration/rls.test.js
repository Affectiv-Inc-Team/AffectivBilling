// Row Level Security isolation tests — the HIPAA-critical layer.
//
// These assert the schema's ACTUAL behavior. The headline finding (verified
// empirically, see docs/TEST_PHASE_3.md "Known risks"):
//
//   The companies SELECT/UPDATE policies use EXISTS subqueries over
//   `licensee_companies` and `licensees`. Those tables are super-admin-only
//   under RLS, so when a *regular* user's policy is evaluated the subqueries
//   return nothing — a regular licensee can SELECT/UPDATE NO companies, even
//   ones correctly assigned to them. Only super-admins can read/write companies.
//
// The crucial security property still HOLDS: a user never sees another
// licensee's data. The bug is the inverse (assigned data is invisible too),
// which is a functionality gap, not a data-leak. These tests pin both: the
// isolation that protects PHI, and the over-restriction to be fixed in Track B.
//
// Assertions use a fresh anon-key client (NOT src/supabase.js's module client).
// Fixtures and cross-checks use the RLS-bypassing adminClient.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import {
  adminClient,
  anonUrl,
  anonPublicKey,
  provisionLicenseeWithCompany,
  createTestSession,
  makeSuperAdmin,
  uniqueEmail,
  cleanupUser,
  cleanupCompany,
  cleanupLicensee,
  teardownAll,
} from './setup.js';

// Track everything created so afterEach tears it down.
let trash;
beforeEach(() => {
  trash = { fixtures: [], emails: [], companyIds: [], licenseeIds: [] };
});
afterEach(async () => {
  for (const f of trash.fixtures) await teardownAll(f);
  for (const id of trash.companyIds) await cleanupCompany(id);
  for (const id of trash.licenseeIds) await cleanupLicensee(id);
  for (const email of trash.emails) await cleanupUser(email);
});

function track(fixture) {
  trash.fixtures.push(fixture);
  return fixture;
}

// A signed-in super-admin client + the email for teardown.
async function provisionSuperAdmin() {
  const email = uniqueEmail('admin');
  const { client, userId } = await createTestSession(email);
  trash.emails.push(email);
  // The companies/licensees policies read is_super_admin from the profiles
  // table at query time, not from a JWT claim — so flipping the flag after
  // sign-in takes effect immediately, no re-auth needed.
  await makeSuperAdmin(userId);
  return { client, userId, email };
}

describe('companies RLS', () => {
  it('unauthenticated SELECT returns empty (not an error)', async () => {
    const anon = createClient(anonUrl, anonPublicKey);
    const { data, error } = await anon.from('companies').select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('GAP: an assigned editor cannot SELECT their own company (sees empty)', async () => {
    const f = track(await provisionLicenseeWithCompany({ role: 'editor' }));
    const { data, error } = await f.client.from('companies').select('id').eq('id', f.companyId);
    expect(error).toBeNull();
    // Per docs this SHOULD return the assigned row; it returns empty.
    expect(data).toEqual([]);
  });

  it("a licensee cannot SELECT another licensee's company", async () => {
    const a = track(await provisionLicenseeWithCompany({ role: 'editor' }));
    const b = track(await provisionLicenseeWithCompany({ role: 'editor' }));
    const { data, error } = await a.client.from('companies').select('id').eq('id', b.companyId);
    expect(error).toBeNull();
    expect(data).toEqual([]); // isolation holds — never sees B's company
  });

  it('GAP: an editor UPDATE affects 0 rows (no error)', async () => {
    const f = track(await provisionLicenseeWithCompany({ role: 'editor' }));
    const { data, error } = await f.client
      .from('companies')
      .update({ name: 'Hacked' })
      .eq('id', f.companyId)
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([]); // policy subquery can't see the assignment → 0 rows
  });

  it('a read_only UPDATE affects 0 rows and leaves the row unchanged', async () => {
    const f = track(await provisionLicenseeWithCompany({ role: 'read_only', companyConfig: { shared: { wage: 5 } } }));
    const { data, error } = await f.client
      .from('companies')
      .update({ config: { shared: { wage: 999 } } })
      .eq('id', f.companyId)
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([]);

    // Confirm the value is unchanged, via the admin client.
    const { data: row } = await adminClient.from('companies').select('config').eq('id', f.companyId).single();
    expect(row.config.shared.wage).toBe(5);
  });

  it('a super-admin can SELECT all companies regardless of assignment', async () => {
    const a = track(await provisionLicenseeWithCompany({ role: 'editor' }));
    const b = track(await provisionLicenseeWithCompany({ role: 'editor' }));
    const sa = await provisionSuperAdmin();

    const { data, error } = await sa.client.from('companies').select('id');
    expect(error).toBeNull();
    const ids = data.map((r) => r.id);
    expect(ids).toContain(a.companyId);
    expect(ids).toContain(b.companyId);
  });
});

describe('profiles RLS', () => {
  it('a user can SELECT their own profile row', async () => {
    const email = uniqueEmail('prof');
    trash.emails.push(email);
    const { client, userId } = await createTestSession(email);
    const { data, error } = await client.from('profiles').select('id, email').eq('id', userId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe(userId);
  });

  it("a user cannot SELECT another user's profile", async () => {
    const emailA = uniqueEmail('prof-a');
    const emailB = uniqueEmail('prof-b');
    trash.emails.push(emailA, emailB);
    const a = await createTestSession(emailA);
    const b = await createTestSession(emailB);
    const { data, error } = await a.client.from('profiles').select('id').eq('id', b.userId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('a user can UPDATE their own profile row', async () => {
    const email = uniqueEmail('prof-upd');
    trash.emails.push(email);
    const { client, userId } = await createTestSession(email);
    const { data, error } = await client
      .from('profiles')
      .update({ email })
      .eq('id', userId)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(1); // own-row update succeeds (doc is correct here)
  });
});

describe('licensees RLS', () => {
  it('a regular user cannot SELECT licensees (super-admin only)', async () => {
    const f = track(await provisionLicenseeWithCompany({ role: 'editor' }));
    const { data, error } = await f.client.from('licensees').select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('a super-admin can SELECT licensees', async () => {
    const f = track(await provisionLicenseeWithCompany({ role: 'editor' }));
    const sa = await provisionSuperAdmin();
    const { data, error } = await sa.client.from('licensees').select('id');
    expect(error).toBeNull();
    expect(data.some((r) => r.id === f.licenseeId)).toBe(true);
  });
});
