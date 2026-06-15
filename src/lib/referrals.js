import { supabase } from '../supabase.js';
import { isSaveable, buildDisplayLabel } from './referralShape.js';

// ─── Referral & Intake Tracker — Supabase data layer ────────────────────────
// One tracker per company; tenant isolation + the SSN restriction are enforced
// at the database layer (RLS + SECURITY DEFINER RPCs). These functions are thin
// wrappers that keep the display_label in sync and route SSN through the RPCs.

// Columns the client may write directly (full SSN is never one of them).
const WRITABLE = [
  'company_id', 'display_label', 'stage', 'priority',
  'source_type', 'intake_method', 'date_received', 'referring_party', 'assigned_to',
  'first_name', 'last_name', 'preferred_name', 'dob', 'is_minor', 'ssn_last4',
  'city', 'county', 'region', 'state', 'service_level', 'pay_source', 'tsc',
  'next_followup_date', 'next_followup_owner',
  'outcome', 'outcome_reason', 'decision_date', 'client_record_link', 'details',
];

function pickWritable(patch) {
  const out = {};
  for (const key of WRITABLE) {
    if (!(key in patch)) continue;
    const v = patch[key];
    if (v === undefined) continue;             // let column defaults apply
    // Empty strings would break typed columns (date/uuid) — store null instead.
    out[key] = typeof v === "string" && v.trim() === "" ? null : v;
  }
  return out;
}

/** All referrals for a company, newest activity first. */
export async function listReferrals(companyId) {
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('company_id', companyId)
    .order('last_activity_at', { ascending: false });
  if (error) { console.error('listReferrals error:', error); return []; }
  return data ?? [];
}

/** A single referral plus its contacts and activity log. */
export async function getReferral(id) {
  const [{ data: referral }, { data: contacts }, { data: activity }] = await Promise.all([
    supabase.from('referrals').select('*').eq('id', id).single(),
    supabase.from('referral_contacts').select('*').eq('referral_id', id),
    supabase.from('referral_activity').select('*').eq('referral_id', id)
      .order('created_at', { ascending: false }),
  ]);
  if (!referral) return null;
  return { ...referral, contacts: contacts ?? [], activity: activity ?? [] };
}

/**
 * Create a referral. Enforces the one-field-to-save rule (soft: only blocks a
 * fully empty record) and computes the display label.
 * Returns { data, error }.
 */
export async function createReferral(companyId, draft = {}) {
  if (!isSaveable(draft)) {
    return { data: null, error: { message: 'Add at least one detail before saving.' } };
  }
  const patch = pickWritable({ ...draft, company_id: companyId });
  patch.display_label = buildDisplayLabel({ ...draft, company_id: companyId });

  const { data, error } = await supabase
    .from('referrals').insert(patch).select().single();
  if (error) console.error('createReferral error:', error);
  return { data: data ?? null, error };
}

/** Update a referral. Recomputes the label from the merged result. */
export async function updateReferral(id, draft = {}) {
  const patch = pickWritable(draft);
  patch.display_label = buildDisplayLabel(draft);
  const { data, error } = await supabase
    .from('referrals').update(patch).eq('id', id).select().single();
  if (error) console.error('updateReferral error:', error);
  return { data: data ?? null, error };
}

// ─── Repeatable contacts ────────────────────────────────────────────────────

export async function addContact(referralId, contact) {
  const { data, error } = await supabase
    .from('referral_contacts')
    .insert({ ...contact, referral_id: referralId })  // company_id auto-filled by trigger
    .select().single();
  if (error) console.error('addContact error:', error);
  return { data: data ?? null, error };
}

export async function updateContact(id, patch) {
  const { error } = await supabase.from('referral_contacts').update(patch).eq('id', id);
  if (error) console.error('updateContact error:', error);
  return { error };
}

export async function removeContact(id) {
  const { error } = await supabase.from('referral_contacts').delete().eq('id', id);
  if (error) console.error('removeContact error:', error);
  return { error };
}

// ─── Activity log ─────────────────────────────────────────────────────────────

export async function addActivity(referralId, body, kind = 'note') {
  const { data, error } = await supabase
    .from('referral_activity')
    .insert({ referral_id: referralId, body, kind })  // company_id + author auto-filled
    .select().single();
  if (error) console.error('addActivity error:', error);
  return { data: data ?? null, error };
}

// ─── SSN (routed through SECURITY DEFINER RPCs; never touches the column) ─────

/** Set or clear the full SSN. Stores it encrypted + the masked last-4. */
export async function setSSN(referralId, ssn) {
  const { error } = await supabase.rpc('referral_set_ssn', {
    p_referral_id: referralId, p_ssn: ssn,
  });
  if (error) console.error('setSSN error:', error);
  return { error };
}

/**
 * Reveal the full SSN. The DB enforces role tier <= 3 and audit-logs the access;
 * a denied call returns an error, not the value.
 */
export async function revealSSN(referralId) {
  const { data, error } = await supabase.rpc('referral_reveal_ssn', {
    p_referral_id: referralId,
  });
  if (error) console.error('revealSSN error:', error);
  return { ssn: data ?? null, error };
}
