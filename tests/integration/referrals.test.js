// Integration tests for the Referral & Intake Tracker — exercises real RLS and
// the SSN encryption RPCs against local Supabase. Mirrors the fixture/teardown
// pattern in setup.js (each test owns its fixtures).

import { describe, it, expect, afterEach } from 'vitest';
import {
  adminClient,
  provisionLicenseeWithCompany,
  makeSuperAdmin,
  teardownAll,
} from './setup.js';

const fixtures = [];

afterEach(async () => {
  while (fixtures.length) await teardownAll(fixtures.pop());
});

async function setRole(userId, role) {
  const { error } = await adminClient.from('profiles').update({ role }).eq('id', userId);
  if (error) throw new Error(`setRole failed: ${error.message}`);
}

describe('referrals — tenant isolation', () => {
  it('an editor sees only their own company’s referrals', async () => {
    const a = await provisionLicenseeWithCompany({ emailPrefix: 'refa' });
    const b = await provisionLicenseeWithCompany({ emailPrefix: 'refb' });
    fixtures.push(a, b);

    // Seed one referral in each company via the admin client (bypasses RLS).
    await adminClient.from('referrals').insert([
      { company_id: a.companyId, first_name: 'Alpha' },
      { company_id: b.companyId, first_name: 'Bravo' },
    ]);

    const { data: aSees } = await a.client.from('referrals').select('first_name');
    expect(aSees.map(r => r.first_name)).toEqual(['Alpha']);

    // A cannot read B's company even by explicit filter.
    const { data: crossTenant } = await a.client
      .from('referrals').select('first_name').eq('company_id', b.companyId);
    expect(crossTenant).toEqual([]);
  });

  it('an editor can insert a referral into their own company', async () => {
    const a = await provisionLicenseeWithCompany({ emailPrefix: 'refins' });
    fixtures.push(a);
    const { data, error } = await a.client
      .from('referrals').insert({ company_id: a.companyId, first_name: 'Casey' })
      .select().single();
    expect(error).toBeNull();
    expect(data.id).toBeTruthy();
  });
});

describe('referrals — SSN RPCs', () => {
  it('stores the SSN encrypted (last-4 only on the row, no plaintext in the blob)', async () => {
    const f = await provisionLicenseeWithCompany({ emailPrefix: 'refssn' });
    fixtures.push(f);
    const { data: ref } = await f.client
      .from('referrals').insert({ company_id: f.companyId, first_name: 'Dana' })
      .select().single();

    const { error } = await f.client.rpc('referral_set_ssn', {
      p_referral_id: ref.id, p_ssn: '123-45-6789',
    });
    expect(error).toBeNull();

    // Masked last-4 is visible on the row.
    const { data: row } = await f.client
      .from('referrals').select('ssn_last4').eq('id', ref.id).single();
    expect(row.ssn_last4).toBe('6789');

    // The encrypted blob (read via admin) must not contain the plaintext, and
    // the referral_ssn table is unreachable by the authenticated client.
    const { data: blob } = await adminClient
      .from('referral_ssn').select('ssn_encrypted').eq('referral_id', ref.id).single();
    expect(blob.ssn_encrypted).toBeTruthy();
    const { error: noAccess } = await f.client
      .from('referral_ssn').select('ssn_encrypted').eq('referral_id', ref.id);
    expect(noAccess).not.toBeNull();  // RLS/grant denies direct access
  });

  it('a tier-1 user can reveal; the access is audit-logged', async () => {
    const f = await provisionLicenseeWithCompany({ emailPrefix: 'refreveal' });
    fixtures.push(f);
    await makeSuperAdmin(f.userId);  // super admin → tier 1
    const { data: ref } = await f.client
      .from('referrals').insert({ company_id: f.companyId, first_name: 'Erin' })
      .select().single();
    await f.client.rpc('referral_set_ssn', { p_referral_id: ref.id, p_ssn: '987654321' });

    const { data: revealed, error } = await f.client
      .rpc('referral_reveal_ssn', { p_referral_id: ref.id });
    expect(error).toBeNull();
    expect(revealed).toBe('987654321');

    const { data: audit } = await adminClient
      .from('referral_audit_log').select('action')
      .eq('referral_id', ref.id).eq('action', 'reveal_ssn');
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });

  it('a below-floor role (REGIONAL_DIRECTOR, tier 4) is denied reveal', async () => {
    const f = await provisionLicenseeWithCompany({ emailPrefix: 'refdeny' });
    fixtures.push(f);
    // Create the referral while still an editor, then drop the role below the floor.
    const { data: ref } = await f.client
      .from('referrals').insert({ company_id: f.companyId, first_name: 'Finn' })
      .select().single();
    await setRole(f.userId, 'REGIONAL_DIRECTOR');

    // Has tenant access, so the reveal reaches — and is rejected by — the tier gate.
    const { error } = await f.client.rpc('referral_reveal_ssn', { p_referral_id: ref.id });
    expect(error).not.toBeNull();  // insufficient_privilege from the tier check
  });
});
