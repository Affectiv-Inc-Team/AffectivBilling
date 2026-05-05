/**
 * Idaho Medicaid Rate Catalog
 *
 * Seeded from Idaho DHW fee schedules (effective 9/1/2025, post-4% reduction)
 * and Magellan IBHP rates (effective 4/13/2026).
 *
 * Each rate record:
 *   {
 *     code:        HCPCS/CPT/Revenue code
 *     modifier:    rate-distinguishing modifier (HM, HQ, HN, HO, U1, etc.) or ''
 *     desc:        human-readable description
 *     unit:        '15min' | 'day' | 'visit' | 'hour' | 'mile' | 'meal' | 'month' | 'one_time' | 'manual'
 *     rate:        dollars per unit (or null for "as authorized" / manually priced)
 *     lines:       array of SERVICE_LINE_TYPES that bill this code
 *     tier:        credential tier id, when distinct rates exist by credential
 *                  ('PHYSICIAN' | 'MED_PSYCH' | 'PSYCH' | 'PARAPRO' | 'TECH' | 'SPECIALIST' |
 *                   'PROFESSIONAL' | 'EBM_PARA' | 'EBM_SPEC' | 'EBM_PROF' | null)
 *     note:        optional clarifying note (county, age band, etc.)
 *   }
 *
 * The catalog is deliberately flat — query helpers below build whatever
 * shape the calculator needs. Same code can appear in multiple service lines
 * if rates match (e.g., T1001 nursing assess at $97.82 in PAA + RALF + PDN).
 *
 * IMPORTANT — codes with rate variation across service lines:
 *   T1019 PCS is $5.12 in CFH/RALF but $6.11 in PAA. These are separate records.
 *   S5100 ADH is $1.44 in RALF, $1.87 in CFH, $2.68 standalone. Separate records.
 *
 * For licensee-specific override rates (negotiated rates, post-effective-date
 * adjustments), the calculator first checks the service line's `config.rateOverrides`
 * map, then falls back to this catalog.
 */

const T = {
  RES_HAB_DAILY: 'RES_HAB_DAILY',
  RES_HAB_HOURLY: 'RES_HAB_HOURLY',
  ICF: 'ICF',
  SNF: 'SNF',
  CFH: 'CFH',
  RALF: 'RALF',
  ADULT_DAY_HEALTH: 'ADULT_DAY_HEALTH',
  TSC: 'TSC',
  AD_CASE_MGMT: 'AD_CASE_MGMT',
  SUPPORT_BROKER: 'SUPPORT_BROKER',
  VOC_SERVICES: 'VOC_SERVICES',
  ADULT_DDA: 'ADULT_DDA',
  CHILDRENS_DDA: 'CHILDRENS_DDA',
  CHILDRENS_DD_INDEPENDENT: 'CHILDRENS_DD_INDEPENDENT',
  PAA: 'PAA',
  HOME_HEALTH: 'HOME_HEALTH',
  PDN: 'PDN',
  HOSPICE: 'HOSPICE',
  SCHOOL_BASED: 'SCHOOL_BASED',
  BH_OUTPATIENT: 'BH_OUTPATIENT',
  BH_CBRS: 'BH_CBRS',
  BH_CRISIS: 'BH_CRISIS',
  BH_CHILDRENS_IHCBS: 'BH_CHILDRENS_IHCBS',
  BH_SUD: 'BH_SUD',
  BH_DAY_TREATMENT: 'BH_DAY_TREATMENT',
  BH_SSH: 'BH_SSH',
  SELF_DIRECT: 'SELF_DIRECT',
};

// ──────────────────────────────────────────────────────────────────────
// RATE RECORDS
// ──────────────────────────────────────────────────────────────────────
const RATES = [
  // ═════════════════════════════════════════════════════════════════
  // RES_HAB DAILY — DD Waiver Daily Supported Living
  // Source: Adult DD Waiver, A&D Waiver fee schedules (eff 9/1/2025)
  // ═════════════════════════════════════════════════════════════════
  { code: 'H2016', modifier: '',         desc: 'Daily Supported Living — Intense Support',                   unit: 'day',    rate: 726.22, lines: [T.RES_HAB_DAILY] },
  { code: 'H2016', modifier: 'SCHOOL',   desc: 'Daily SL Intense — School Based, School Days (Adult DD)',    unit: 'day',    rate: 574.92, lines: [T.RES_HAB_DAILY], note: 'Adult DD waiver only, school days' },
  { code: 'H2022', modifier: '',         desc: 'Daily Supported Living — High Support',                      unit: 'day',    rate: 394.44, lines: [T.RES_HAB_DAILY] },
  { code: 'H2016', modifier: 'SCHOOL_H', desc: 'Daily SL High — School Based, School Days (Adult DD)',       unit: 'day',    rate: 312.27, lines: [T.RES_HAB_DAILY], note: 'Adult DD waiver only, school days' },
  { code: 'H2020', modifier: '',         desc: 'Therapeutic Behavioral Services — Agency',                   unit: 'day',    rate: 45.94,  lines: [T.RES_HAB_DAILY, T.PAA] },
  { code: 'S5140', modifier: '',         desc: 'Adult Residential Care — CFH (DD waiver)',                   unit: 'day',    rate: 69.41,  lines: [T.RES_HAB_DAILY], note: 'Adult DD waiver CFH-as-ResHab' },

  // ═════════════════════════════════════════════════════════════════
  // RES_HAB HOURLY — DD Waiver Hourly Supported Living
  // ═════════════════════════════════════════════════════════════════
  { code: 'H2015', modifier: '',         desc: 'Individual Supported Living',                                unit: '15min',  rate: 7.56,   lines: [T.RES_HAB_HOURLY] },
  { code: 'H2015', modifier: 'HQ',       desc: 'Group Supported Living',                                     unit: '15min',  rate: 3.86,   lines: [T.RES_HAB_HOURLY] },

  // ═════════════════════════════════════════════════════════════════
  // TSC — Targeted Service Coordination
  // ═════════════════════════════════════════════════════════════════
  { code: 'G9002', modifier: '',         desc: 'DD / Children\'s Service Coordination',                      unit: '15min',  rate: 20.97,  lines: [T.TSC] },
  { code: 'G9002', modifier: 'HM',       desc: 'Service Coordination — Paraprofessional',                    unit: '15min',  rate: 13.46,  lines: [T.TSC], tier: 'PARAPRO' },
  { code: 'G9007', modifier: '',         desc: 'DD / Children\'s Plan Development',                          unit: '15min',  rate: 20.97,  lines: [T.TSC] },
  { code: 'H2011', modifier: '',         desc: 'DD / Children\'s Crisis Assistance',                         unit: '15min',  rate: 20.97,  lines: [T.TSC] },
  { code: 'H2011', modifier: 'HM',       desc: 'Crisis Assistance — Paraprofessional',                       unit: '15min',  rate: 13.46,  lines: [T.TSC], tier: 'PARAPRO' },

  // ═════════════════════════════════════════════════════════════════
  // AD_CASE_MGMT — A&D Case Management
  // ═════════════════════════════════════════════════════════════════
  { code: 'G9002', modifier: 'CC',       desc: 'A&D Case Management — Agency',                               unit: '15min',  rate: 13.46,  lines: [T.AD_CASE_MGMT, T.PAA] },
  { code: 'G9001', modifier: '',         desc: 'Coordinated Care Fee — Initial (Agency)',                    unit: 'visit',  rate: 118.74, lines: [T.AD_CASE_MGMT, T.PAA] },

  // ═════════════════════════════════════════════════════════════════
  // CFH — Certified Family Home
  // ═════════════════════════════════════════════════════════════════
  { code: 'S5100', modifier: '',         desc: 'Adult Day Health (CFH context)',                             unit: '15min',  rate: 1.87,   lines: [T.CFH] },
  { code: 'S5140', modifier: '',         desc: 'Adult Residential Care — CFH',                               unit: 'day',    rate: null,   lines: [T.CFH], note: 'As authorized per participant' },
  { code: 'T1005', modifier: '',         desc: 'Respite — CFH',                                              unit: '15min',  rate: 2.53,   lines: [T.CFH] },
  { code: 'T1019', modifier: 'CFH',      desc: 'Personal Care Services — CFH',                               unit: '15min',  rate: 5.12,   lines: [T.CFH] },

  // ═════════════════════════════════════════════════════════════════
  // RALF — Residential Assisted Living Facility
  // ═════════════════════════════════════════════════════════════════
  { code: 'S5100', modifier: 'RALF',     desc: 'Adult Day Health (RALF context)',                            unit: '15min',  rate: 1.44,   lines: [T.RALF] },
  { code: 'S5140', modifier: 'RALF',     desc: 'Adult Residential Care — RALF',                              unit: 'day',    rate: null,   lines: [T.RALF], note: 'As authorized per participant' },
  { code: 'T1019', modifier: 'RALF',     desc: 'Personal Care Services — RALF',                              unit: '15min',  rate: 5.12,   lines: [T.RALF] },
  { code: 'T1019', modifier: 'HE',       desc: 'Milieu Management — RALF',                                   unit: 'day',    rate: 62.40,  lines: [T.RALF] },

  // ═════════════════════════════════════════════════════════════════
  // ADULT_DAY_HEALTH — Standalone Adult Day Health
  // ═════════════════════════════════════════════════════════════════
  { code: 'S5100', modifier: 'STANDALONE', desc: 'Adult Day Health — Standalone',                            unit: '15min',  rate: 2.68,   lines: [T.ADULT_DAY_HEALTH, T.ADULT_DDA] },

  // ═════════════════════════════════════════════════════════════════
  // VOC_SERVICES — Supported Employment
  // ═════════════════════════════════════════════════════════════════
  { code: 'H2023', modifier: '',         desc: 'Supported Employment',                                       unit: '15min',  rate: 11.44,  lines: [T.VOC_SERVICES, T.ADULT_DDA] },

  // ═════════════════════════════════════════════════════════════════
  // ADULT_DDA — Adult DD State Plan HCBS + Adult DD Waiver
  // ═════════════════════════════════════════════════════════════════
  { code: '97537', modifier: '',         desc: 'Home/Community Individual or Group DT for Adults',           unit: '15min',  rate: 6.01,   lines: [T.ADULT_DDA] },
  { code: 'H2032', modifier: '',         desc: 'Center-Based Individual or Group DT for Adults',             unit: '15min',  rate: 4.00,   lines: [T.ADULT_DDA] },
  { code: 'H2000', modifier: '',         desc: 'Developmental Therapy Evaluation',                           unit: '15min',  rate: 16.27,  lines: [T.ADULT_DDA] },
  { code: 'H2011', modifier: 'CRISIS',   desc: 'Community Crisis Supports',                                  unit: '15min',  rate: 10.90,  lines: [T.ADULT_DDA] },
  { code: 'H2019', modifier: 'QIDP',     desc: 'Behavioral Consultation by QIDP/Clinician',                  unit: '15min',  rate: 6.16,   lines: [T.ADULT_DDA] },
  { code: 'H2019', modifier: 'PSYCH',    desc: 'Behavioral Consultation by Psychiatrist',                    unit: '15min',  rate: 9.62,   lines: [T.ADULT_DDA] },
  { code: 'H2019', modifier: 'HM',       desc: 'Behavioral Consultation Emergency Intervention Tech',        unit: '15min',  rate: 2.78,   lines: [T.ADULT_DDA] },
  { code: 'S9125', modifier: '',         desc: 'Respite Care Daily',                                         unit: 'day',    rate: 51.25,  lines: [T.ADULT_DDA] },
  { code: 'T1000', modifier: 'INDEP_RN', desc: 'Skilled Nursing — Independent RN',                           unit: '15min',  rate: 14.68,  lines: [T.ADULT_DDA] },
  { code: 'T1000', modifier: 'TE',       desc: 'Skilled Nursing — Agency LPN',                               unit: '15min',  rate: 14.04,  lines: [T.ADULT_DDA] },
  { code: 'T1000', modifier: 'TD',       desc: 'Skilled Nursing — Agency RN',                                unit: '15min',  rate: 19.56,  lines: [T.ADULT_DDA] },

  // ═════════════════════════════════════════════════════════════════
  // CHILDRENS_DDA — Children's CHIS for DDA (agency tier)
  // Multiple credential tiers per code
  // ═════════════════════════════════════════════════════════════════
  { code: 'H2014', modifier: '',         desc: 'Habilitative Skill Building — Individual',                   unit: '15min',  rate: 13.54,  lines: [T.CHILDRENS_DDA] },
  { code: 'H2014', modifier: 'HQ',       desc: 'Habilitative Skill Building — Group',                        unit: '15min',  rate: 5.41,   lines: [T.CHILDRENS_DDA] },
  // Eligibility Screening — H2000
  { code: 'H2000', modifier: 'HN',       desc: 'Eligibility Screening — Specialist',                         unit: '15min',  rate: 15.48,  lines: [T.CHILDRENS_DDA], tier: 'SPECIALIST' },
  { code: 'H2000', modifier: 'HO',       desc: 'Eligibility Screening — Professional',                       unit: '15min',  rate: 21.34,  lines: [T.CHILDRENS_DDA], tier: 'PROFESSIONAL' },
  { code: 'H2000', modifier: 'TF',       desc: 'Eligibility Screening — EBM Specialist',                     unit: '15min',  rate: 17.63,  lines: [T.CHILDRENS_DDA], tier: 'EBM_SPEC' },
  { code: 'H2000', modifier: 'TG',       desc: 'Eligibility Screening — EBM Professional',                   unit: '15min',  rate: 21.82,  lines: [T.CHILDRENS_DDA], tier: 'EBM_PROF' },
  // Assessment / Treatment Plan — H0032
  { code: 'H0032', modifier: 'HN',       desc: 'Assessment & Clinical Treatment — Specialist',               unit: '15min',  rate: 15.48,  lines: [T.CHILDRENS_DDA], tier: 'SPECIALIST' },
  { code: 'H0032', modifier: 'HO',       desc: 'Assessment & Clinical Treatment — Professional',             unit: '15min',  rate: 21.34,  lines: [T.CHILDRENS_DDA], tier: 'PROFESSIONAL' },
  { code: 'H0032', modifier: 'TF',       desc: 'Assessment & Clinical Treatment — EBM Specialist',           unit: '15min',  rate: 17.63,  lines: [T.CHILDRENS_DDA], tier: 'EBM_SPEC' },
  { code: 'H0032', modifier: 'TG',       desc: 'Assessment & Clinical Treatment — EBM Professional',         unit: '15min',  rate: 21.82,  lines: [T.CHILDRENS_DDA], tier: 'EBM_PROF' },
  // Behavioral Intervention Individual — H0004
  { code: 'H0004', modifier: 'HA',       desc: 'Behavioral Intervention Individual — Technician',            unit: '15min',  rate: 13.54,  lines: [T.CHILDRENS_DDA], tier: 'TECH' },
  { code: 'H0004', modifier: 'HN',       desc: 'Behavioral Intervention Individual — Specialist',            unit: '15min',  rate: 15.48,  lines: [T.CHILDRENS_DDA], tier: 'SPECIALIST' },
  { code: 'H0004', modifier: 'HO',       desc: 'Behavioral Intervention Individual — Professional',          unit: '15min',  rate: 21.34,  lines: [T.CHILDRENS_DDA], tier: 'PROFESSIONAL' },
  { code: 'H0004', modifier: 'EBM',      desc: 'Behavioral Intervention Individual — EBM Paraprofessional',  unit: '15min',  rate: 14.34,  lines: [T.CHILDRENS_DDA], tier: 'EBM_PARA' },
  { code: 'H0004', modifier: 'TF',       desc: 'Behavioral Intervention Individual — EBM Specialist',        unit: '15min',  rate: 18.51,  lines: [T.CHILDRENS_DDA], tier: 'EBM_SPEC' },
  { code: 'H0004', modifier: 'TG',       desc: 'Behavioral Intervention Individual — EBM Professional',      unit: '15min',  rate: 24.68,  lines: [T.CHILDRENS_DDA], tier: 'EBM_PROF' },
  // Behavioral Intervention Group — H0005
  { code: 'H0005', modifier: 'HA',       desc: 'Behavioral Intervention Group — Technician',                 unit: '15min',  rate: 5.41,   lines: [T.CHILDRENS_DDA], tier: 'TECH' },
  { code: 'H0005', modifier: 'HN',       desc: 'Behavioral Intervention Group — Specialist',                 unit: '15min',  rate: 6.18,   lines: [T.CHILDRENS_DDA], tier: 'SPECIALIST' },
  { code: 'H0005', modifier: 'HO',       desc: 'Behavioral Intervention Group — Professional',               unit: '15min',  rate: 8.53,   lines: [T.CHILDRENS_DDA], tier: 'PROFESSIONAL' },
  { code: 'H0005', modifier: 'EBM',      desc: 'Behavioral Intervention Group — EBM Paraprofessional',       unit: '15min',  rate: 5.73,   lines: [T.CHILDRENS_DDA], tier: 'EBM_PARA' },
  { code: 'H0005', modifier: 'TF',       desc: 'Behavioral Intervention Group — EBM Specialist',             unit: '15min',  rate: 7.41,   lines: [T.CHILDRENS_DDA], tier: 'EBM_SPEC' },
  { code: 'H0005', modifier: 'TG',       desc: 'Behavioral Intervention Group — EBM Professional',           unit: '15min',  rate: 9.88,   lines: [T.CHILDRENS_DDA], tier: 'EBM_PROF' },
  // Crisis — H2011 (CHIS)
  { code: 'H2011', modifier: 'HA',       desc: 'Crisis Intervention — Technician (CHIS)',                    unit: '15min',  rate: 8.71,   lines: [T.CHILDRENS_DDA], tier: 'TECH' },
  { code: 'H2011', modifier: 'HM_CHIS',  desc: 'Crisis Intervention — Habilitative Skill Tech (CHIS)',       unit: '15min',  rate: 13.54,  lines: [T.CHILDRENS_DDA] },
  { code: 'H2011', modifier: 'HN',       desc: 'Crisis Intervention — Specialist (CHIS)',                    unit: '15min',  rate: 15.48,  lines: [T.CHILDRENS_DDA], tier: 'SPECIALIST' },
  { code: 'H2011', modifier: 'HO',       desc: 'Crisis Intervention — Professional (CHIS)',                  unit: '15min',  rate: 21.34,  lines: [T.CHILDRENS_DDA], tier: 'PROFESSIONAL' },
  { code: 'H2011', modifier: 'EBM',      desc: 'Crisis Intervention — EBM Paraprofessional (CHIS)',          unit: '15min',  rate: 14.34,  lines: [T.CHILDRENS_DDA], tier: 'EBM_PARA' },
  { code: 'H2011', modifier: 'TF',       desc: 'Crisis Intervention — EBM Specialist (CHIS)',                unit: '15min',  rate: 17.63,  lines: [T.CHILDRENS_DDA], tier: 'EBM_SPEC' },
  { code: 'H2011', modifier: 'TG',       desc: 'Crisis Intervention — EBM Professional (CHIS)',              unit: '15min',  rate: 21.82,  lines: [T.CHILDRENS_DDA], tier: 'EBM_PROF' },
  // CHIS Support services
  { code: 'H2019', modifier: 'HT',       desc: 'Interdisciplinary Training (CHIS)',                          unit: '15min',  rate: 15.48,  lines: [T.CHILDRENS_DDA] },
  { code: 'H0024', modifier: '',         desc: 'Family Education — Individual',                              unit: '15min',  rate: 12.39,  lines: [T.CHILDRENS_DDA] },
  { code: 'H0024', modifier: 'HQ',       desc: 'Family Education — Group',                                   unit: '15min',  rate: 4.13,   lines: [T.CHILDRENS_DDA] },
  { code: 'H2015', modifier: 'HA_CBS',   desc: 'Community Based Supports — Individual (CHIS)',               unit: '15min',  rate: 6.97,   lines: [T.CHILDRENS_DDA] },
  { code: 'H2015', modifier: 'HQ_CBS',   desc: 'Community Based Supports — Group (CHIS)',                    unit: '15min',  rate: 2.78,   lines: [T.CHILDRENS_DDA] },
  { code: 'T1005', modifier: 'CHIS',     desc: 'Respite Care — Individual (CHIS)',                           unit: '15min',  rate: 3.51,   lines: [T.CHILDRENS_DDA] },
  { code: 'T1005', modifier: 'HQ_CHIS',  desc: 'Respite Care — Group (CHIS)',                                unit: '15min',  rate: 1.17,   lines: [T.CHILDRENS_DDA] },

  // ═════════════════════════════════════════════════════════════════
  // CHILDRENS_DD_INDEPENDENT — same services, lower (independent) rates
  // ═════════════════════════════════════════════════════════════════
  { code: 'H2014', modifier: 'IP',       desc: 'Habilitative Skill Building — Individual (Indep)',           unit: '15min',  rate: 9.46,   lines: [T.CHILDRENS_DD_INDEPENDENT] },
  { code: 'H2014', modifier: 'IP_HQ',    desc: 'Habilitative Skill Building — Group (Indep)',                unit: '15min',  rate: 3.79,   lines: [T.CHILDRENS_DD_INDEPENDENT] },
  { code: 'H2000', modifier: 'IP_HN',    desc: 'Eligibility Screening — Specialist (Indep)',                 unit: '15min',  rate: 10.81,  lines: [T.CHILDRENS_DD_INDEPENDENT], tier: 'SPECIALIST' },
  { code: 'H2000', modifier: 'IP_HO',    desc: 'Eligibility Screening — Professional (Indep)',               unit: '15min',  rate: 14.90,  lines: [T.CHILDRENS_DD_INDEPENDENT], tier: 'PROFESSIONAL' },
  { code: 'H2000', modifier: 'IP_TF',    desc: 'Eligibility Screening — EBM Specialist (Indep)',             unit: '15min',  rate: 12.31,  lines: [T.CHILDRENS_DD_INDEPENDENT], tier: 'EBM_SPEC' },
  { code: 'H2000', modifier: 'IP_TG',    desc: 'Eligibility Screening — EBM Professional (Indep)',           unit: '15min',  rate: 15.24,  lines: [T.CHILDRENS_DD_INDEPENDENT], tier: 'EBM_PROF' },
  { code: 'H0032', modifier: 'IP_HN',    desc: 'Assessment — Specialist (Indep)',                            unit: '15min',  rate: 10.81,  lines: [T.CHILDRENS_DD_INDEPENDENT], tier: 'SPECIALIST' },
  { code: 'H0032', modifier: 'IP_HO',    desc: 'Assessment — Professional (Indep)',                          unit: '15min',  rate: 14.90,  lines: [T.CHILDRENS_DD_INDEPENDENT], tier: 'PROFESSIONAL' },
  { code: 'H0004', modifier: 'IP_HN',    desc: 'Behavioral Intervention Indiv — Specialist (Indep)',         unit: '15min',  rate: 10.81,  lines: [T.CHILDRENS_DD_INDEPENDENT], tier: 'SPECIALIST' },
  { code: 'H0004', modifier: 'IP_HO',    desc: 'Behavioral Intervention Indiv — Professional (Indep)',       unit: '15min',  rate: 14.90,  lines: [T.CHILDRENS_DD_INDEPENDENT], tier: 'PROFESSIONAL' },
  { code: 'H0005', modifier: 'IP_HN',    desc: 'Behavioral Intervention Group — Specialist (Indep)',         unit: '15min',  rate: 4.33,   lines: [T.CHILDRENS_DD_INDEPENDENT], tier: 'SPECIALIST' },
  { code: 'H0005', modifier: 'IP_HO',    desc: 'Behavioral Intervention Group — Professional (Indep)',       unit: '15min',  rate: 5.97,   lines: [T.CHILDRENS_DD_INDEPENDENT], tier: 'PROFESSIONAL' },
  { code: 'H2011', modifier: 'IP_HN',    desc: 'Crisis Intervention — Specialist (Indep)',                   unit: '15min',  rate: 10.81,  lines: [T.CHILDRENS_DD_INDEPENDENT], tier: 'SPECIALIST' },
  { code: 'H2011', modifier: 'IP_HO',    desc: 'Crisis Intervention — Professional (Indep)',                 unit: '15min',  rate: 14.90,  lines: [T.CHILDRENS_DD_INDEPENDENT], tier: 'PROFESSIONAL' },
  { code: 'H2015', modifier: 'IP_CBS',   desc: 'Community Based Supports — Individual (Indep)',              unit: '15min',  rate: 5.41,   lines: [T.CHILDRENS_DD_INDEPENDENT] },
  { code: 'H2015', modifier: 'IP_CBS_HQ', desc: 'Community Based Supports — Group (Indep)',                  unit: '15min',  rate: 2.16,   lines: [T.CHILDRENS_DD_INDEPENDENT] },
  { code: 'T1005', modifier: 'IP',       desc: 'Respite Care — Individual (Indep)',                          unit: '15min',  rate: 2.08,   lines: [T.CHILDRENS_DD_INDEPENDENT] },
  { code: 'T1005', modifier: 'IP_HQ',    desc: 'Respite Care — Group (Indep)',                               unit: '15min',  rate: 0.70,   lines: [T.CHILDRENS_DD_INDEPENDENT] },

  // ═════════════════════════════════════════════════════════════════
  // PAA — Personal Assistance Agency
  // ═════════════════════════════════════════════════════════════════
  { code: 'S5115', modifier: '',         desc: 'Consultation',                                               unit: '15min',  rate: 9.89,   lines: [T.PAA] },
  { code: 'S5120', modifier: '',         desc: 'Chore Services',                                             unit: '15min',  rate: 4.96,   lines: [T.PAA] },
  { code: 'S5125', modifier: '',         desc: 'Attendant Care Services',                                    unit: '15min',  rate: 6.11,   lines: [T.PAA] },
  { code: 'S5130', modifier: '',         desc: 'Homemaker Services',                                         unit: '15min',  rate: 5.26,   lines: [T.PAA] },
  { code: 'S5135', modifier: '',         desc: 'Companion Services',                                         unit: '15min',  rate: 5.54,   lines: [T.PAA] },
  { code: 'S5160', modifier: '',         desc: 'PERS Install / 1st Month Rent',                              unit: 'one_time', rate: 64.44, lines: [T.PAA] },
  { code: 'S5161', modifier: '',         desc: 'PERS Rent',                                                  unit: 'month',  rate: 38.32,  lines: [T.PAA] },
  { code: 'T1019', modifier: 'PAA',      desc: 'Personal Care Services — PAA',                               unit: '15min',  rate: 6.11,   lines: [T.PAA] },
  { code: 'T1019', modifier: 'PAA_FACH', desc: 'PCS Family Alternate Care Home',                             unit: '15min',  rate: 5.28,   lines: [T.PAA] },
  { code: 'T1005', modifier: 'PAA',      desc: 'Respite — PAA',                                              unit: '15min',  rate: 5.54,   lines: [T.PAA] },

  // ═════════════════════════════════════════════════════════════════
  // Nursing — shared across PAA, RALF, PDN, A&D Waiver
  // ═════════════════════════════════════════════════════════════════
  { code: 'T1001', modifier: '',         desc: 'Nursing Assessment / Evaluation — Agency',                   unit: 'visit',  rate: 97.82,  lines: [T.PAA, T.RALF, T.PDN, T.AD_CASE_MGMT] },
  { code: 'T1002', modifier: '',         desc: 'Nursing Services RN',                                        unit: '15min',  rate: 19.56,  lines: [T.PAA, T.RALF, T.PDN] },
  { code: 'T1003', modifier: '',         desc: 'Nursing Services LPN',                                       unit: '15min',  rate: 14.04,  lines: [T.PAA, T.RALF, T.PDN] },
  { code: 'G9002', modifier: 'RN_PLAN',  desc: 'RN Care Plan Development & Placement',                       unit: '15min',  rate: 19.56,  lines: [T.PAA, T.PDN], note: 'Initial = 10 units, Redetermination = 5 units' },
  { code: 'T2021', modifier: '',         desc: 'Day Habilitation',                                           unit: '15min',  rate: 4.35,   lines: [T.PAA, T.AD_CASE_MGMT] },
  { code: 'S5170', modifier: '',         desc: 'Home Delivered Meals',                                       unit: 'meal',   rate: 6.78,   lines: [T.AD_CASE_MGMT] },

  // ═════════════════════════════════════════════════════════════════
  // HOME_HEALTH — per-visit by discipline (RC = revenue code)
  // ═════════════════════════════════════════════════════════════════
  { code: '421',   modifier: '',         desc: 'Physical Therapy',                                           unit: 'visit',  rate: 118.29, lines: [T.HOME_HEALTH], note: 'Max $200.47' },
  { code: '431',   modifier: '',         desc: 'Occupational Therapy',                                       unit: 'visit',  rate: 97.12,  lines: [T.HOME_HEALTH], note: 'Max $219.75' },
  { code: '441',   modifier: '',         desc: 'Speech-Language Pathology, Audiology',                       unit: 'visit',  rate: 159.06, lines: [T.HOME_HEALTH], note: 'Also RC 470/471/472. Max $234.71' },
  { code: '551',   modifier: '',         desc: 'Skilled Nursing',                                            unit: 'visit',  rate: 98.80,  lines: [T.HOME_HEALTH], note: 'Max $272.14' },
  { code: '571',   modifier: '',         desc: 'Home Health Aide',                                           unit: 'visit',  rate: 38.40,  lines: [T.HOME_HEALTH], note: 'Max $198.55' },

  // ═════════════════════════════════════════════════════════════════
  // HOSPICE — county-keyed per-diem (subset; full table in helper below)
  // Effective 10/1/2025 - 9/30/2026
  // ═════════════════════════════════════════════════════════════════
  // Hospice rates are county+code matrices — handled via getHospiceRate() helper

  // ═════════════════════════════════════════════════════════════════
  // SCHOOL_BASED — selected major codes
  // ═════════════════════════════════════════════════════════════════
  { code: '90791', modifier: 'SCHOOL',   desc: 'Psychiatric Diagnostic Evaluation (School)',                 unit: '15min',  rate: 36.34,  lines: [T.SCHOOL_BASED] },
  { code: '90832', modifier: 'SCHOOL',   desc: 'Psychotherapy 30 min (School)',                              unit: 'visit',  rate: 68.96,  lines: [T.SCHOOL_BASED] },
  { code: '90834', modifier: 'SCHOOL',   desc: 'Psychotherapy 45 min (School)',                              unit: 'visit',  rate: 91.03,  lines: [T.SCHOOL_BASED] },
  { code: '90837', modifier: 'SCHOOL',   desc: 'Psychotherapy 60 min (School)',                              unit: 'visit',  rate: 134.77, lines: [T.SCHOOL_BASED] },
  { code: '92507', modifier: 'HM',       desc: 'Speech/Hearing Therapy Indiv — Assistant (School)',          unit: '15min',  rate: 13.69,  lines: [T.SCHOOL_BASED] },
  { code: '92507', modifier: 'HO',       desc: 'Speech/Hearing Therapy Indiv — Professional (School)',       unit: '15min',  rate: 16.10,  lines: [T.SCHOOL_BASED] },
  { code: '97110', modifier: 'HO',       desc: 'Individual Physical Therapy — Professional (School)',        unit: '15min',  rate: 24.60,  lines: [T.SCHOOL_BASED] },
  { code: '97110', modifier: 'CQ',       desc: 'Individual Physical Therapy — PT Assistant (School)',        unit: '15min',  rate: 20.91,  lines: [T.SCHOOL_BASED] },
  { code: '97530', modifier: '',         desc: 'Individual Occupational Therapy — Tech (School)',            unit: '15min',  rate: 6.23,   lines: [T.SCHOOL_BASED] },
  { code: '97530', modifier: 'HO_S',     desc: 'Individual Occupational Therapy — Professional (School)',    unit: '15min',  rate: 29.33,  lines: [T.SCHOOL_BASED] },
  { code: 'A0080', modifier: 'SCHOOL',   desc: 'Transportation by School',                                   unit: 'mile',   rate: 0.44,   lines: [T.SCHOOL_BASED] },
  { code: 'H2017', modifier: 'SCHOOL',   desc: 'Skills Building / CBRS — Individual (School)',               unit: '15min',  rate: 15.44,  lines: [T.SCHOOL_BASED] },
  { code: 'H2017', modifier: 'SCHOOL_HQ', desc: 'Skills Building / CBRS — Group (School)',                   unit: '15min',  rate: 3.86,   lines: [T.SCHOOL_BASED] },

  // ═════════════════════════════════════════════════════════════════
  // BH_OUTPATIENT — Magellan IBHP rates (effective 4/13/2026)
  // Three credential tiers: PHYSICIAN | MED_PSYCH | PSYCH
  // For brevity, only major outpatient codes seeded here.
  // ═════════════════════════════════════════════════════════════════
  // Psychiatric Diagnostic Evaluation
  { code: '90791', modifier: '',         desc: 'Psychiatric Diagnostic Evaluation',                          unit: 'visit',  rate: 214.75, lines: [T.BH_OUTPATIENT], tier: 'PHYSICIAN' },
  { code: '90791', modifier: '',         desc: 'Psychiatric Diagnostic Evaluation',                          unit: 'visit',  rate: 151.86, lines: [T.BH_OUTPATIENT], tier: 'MED_PSYCH' },
  { code: '90791', modifier: 'U1',       desc: 'Psychiatric Diagnostic Evaluation (Prescriber Supervised)',  unit: 'visit',  rate: 136.01, lines: [T.BH_OUTPATIENT] },
  { code: '90792', modifier: '',         desc: 'Psychiatric Diagnostic Evaluation w/ Medical Svcs',          unit: 'visit',  rate: 178.62, lines: [T.BH_OUTPATIENT], tier: 'PHYSICIAN' },
  // Psychotherapy
  { code: '90832', modifier: '',         desc: 'Psychotherapy w/ patient, 30 min',                           unit: 'visit',  rate: 84.71,  lines: [T.BH_OUTPATIENT], tier: 'PHYSICIAN' },
  { code: '90832', modifier: '',         desc: 'Psychotherapy w/ patient, 30 min',                           unit: 'visit',  rate: 63.38,  lines: [T.BH_OUTPATIENT], tier: 'MED_PSYCH' },
  { code: '90834', modifier: '',         desc: 'Psychotherapy w/ patient, 45 min',                           unit: 'visit',  rate: 110.47, lines: [T.BH_OUTPATIENT], tier: 'PHYSICIAN' },
  { code: '90834', modifier: '',         desc: 'Psychotherapy w/ patient, 45 min',                           unit: 'visit',  rate: 95.10,  lines: [T.BH_OUTPATIENT], tier: 'MED_PSYCH' },
  { code: '90837', modifier: '',         desc: 'Psychotherapy w/ patient, 60 min',                           unit: 'visit',  rate: 140.81, lines: [T.BH_OUTPATIENT], tier: 'PHYSICIAN' },
  { code: '90837', modifier: '',         desc: 'Psychotherapy w/ patient, 60 min',                           unit: 'visit',  rate: 112.95, lines: [T.BH_OUTPATIENT], tier: 'MED_PSYCH' },
  { code: '90839', modifier: '',         desc: 'Psychotherapy for Crisis, initial 60 min',                   unit: 'visit',  rate: 143.64, lines: [T.BH_OUTPATIENT], tier: 'PHYSICIAN' },
  { code: '90846', modifier: '',         desc: 'Family Psychotherapy w/o patient, 50 min',                   unit: 'visit',  rate: 124.23, lines: [T.BH_OUTPATIENT], tier: 'PHYSICIAN' },
  { code: '90846', modifier: '',         desc: 'Family Psychotherapy w/o patient, 50 min',                   unit: 'visit',  rate: 100.69, lines: [T.BH_OUTPATIENT], tier: 'MED_PSYCH' },
  { code: '90847', modifier: '',         desc: 'Family Psychotherapy w/ patient, 50 min',                    unit: 'visit',  rate: 142.87, lines: [T.BH_OUTPATIENT], tier: 'PHYSICIAN' },
  { code: '90847', modifier: '',         desc: 'Family Psychotherapy w/ patient, 50 min',                    unit: 'visit',  rate: 115.80, lines: [T.BH_OUTPATIENT], tier: 'MED_PSYCH' },
  { code: '90853', modifier: '',         desc: 'Group Psychotherapy',                                        unit: 'visit',  rate: 48.06,  lines: [T.BH_OUTPATIENT], tier: 'PHYSICIAN' },
  { code: '90853', modifier: '',         desc: 'Group Psychotherapy',                                        unit: 'visit',  rate: 28.83,  lines: [T.BH_OUTPATIENT], tier: 'MED_PSYCH' },
  // Office E&M (subset)
  { code: '99202', modifier: '',         desc: 'Office Outpatient Visit, New Patient, 15 min',               unit: 'visit',  rate: 80.53,  lines: [T.BH_OUTPATIENT], tier: 'PHYSICIAN' },
  { code: '99203', modifier: '',         desc: 'Office Outpatient Visit, New Patient, 30 min',               unit: 'visit',  rate: 118.09, lines: [T.BH_OUTPATIENT], tier: 'PHYSICIAN' },
  { code: '99204', modifier: '',         desc: 'Office Outpatient Visit, New Patient, 45 min',               unit: 'visit',  rate: 181.75, lines: [T.BH_OUTPATIENT], tier: 'PHYSICIAN' },
  { code: '99205', modifier: '',         desc: 'Office Outpatient Visit, New Patient, 60 min',               unit: 'visit',  rate: 228.79, lines: [T.BH_OUTPATIENT], tier: 'PHYSICIAN' },
  { code: '99213', modifier: '',         desc: 'Office Outpatient Visit, Established, 20 min',               unit: 'visit',  rate: 80.91,  lines: [T.BH_OUTPATIENT], tier: 'PHYSICIAN' },
  { code: '99214', modifier: '',         desc: 'Office Outpatient Visit, Established, 30 min',               unit: 'visit',  rate: 117.96, lines: [T.BH_OUTPATIENT], tier: 'PHYSICIAN' },
  { code: '99215', modifier: '',         desc: 'Office Outpatient Visit, Established, 40 min',               unit: 'visit',  rate: 161.05, lines: [T.BH_OUTPATIENT], tier: 'PHYSICIAN' },

  // ═════════════════════════════════════════════════════════════════
  // BH_CRISIS — Magellan IBHP crisis services
  // ═════════════════════════════════════════════════════════════════
  { code: 'H2011', modifier: 'BH',       desc: 'Crisis Intervention',                                        unit: '15min',  rate: 51.56,  lines: [T.BH_CRISIS], tier: 'PHYSICIAN' },
  { code: 'H2011', modifier: 'BH',       desc: 'Crisis Intervention',                                        unit: '15min',  rate: 38.59,  lines: [T.BH_CRISIS], tier: 'MED_PSYCH' },
  { code: 'H2011', modifier: 'HN_BH',    desc: 'Crisis Intervention (Bachelor\'s under supervision)',        unit: '15min',  rate: 22.64,  lines: [T.BH_CRISIS], tier: 'PARAPRO' },
  { code: 'H0030', modifier: '',         desc: 'Crisis Response (Telephonic)',                               unit: 'visit',  rate: 53.40,  lines: [T.BH_CRISIS], tier: 'PHYSICIAN', note: 'Per call' },
  { code: 'H0030', modifier: '',         desc: 'Crisis Response (Telephonic)',                               unit: 'visit',  rate: 39.96,  lines: [T.BH_CRISIS], tier: 'MED_PSYCH', note: 'Per call' },
  { code: 'H0030', modifier: 'HN',       desc: 'Crisis Response (Telephonic — Bachelor\'s)',                 unit: 'visit',  rate: 25.05,  lines: [T.BH_CRISIS], tier: 'PARAPRO', note: 'Per call' },

  // ═════════════════════════════════════════════════════════════════
  // BH_CBRS — FQHC/RHC Paraprofessional rates (representative subset)
  // ═════════════════════════════════════════════════════════════════
  { code: 'H2017', modifier: 'UB',       desc: 'Skills Building / CBRS — Paraprofessional',                  unit: '15min',  rate: 14.82,  lines: [T.BH_CBRS], tier: 'PARAPRO' },
  { code: 'H0006', modifier: 'UB',       desc: 'Case Management, BH — Paraprofessional',                     unit: '15min',  rate: 14.64,  lines: [T.BH_CBRS], tier: 'PARAPRO' },
  { code: 'H0004', modifier: 'UB_BH',    desc: 'Skills Training & Development — Paraprofessional',           unit: '15min',  rate: 19.25,  lines: [T.BH_CBRS], tier: 'PARAPRO' },
  { code: 'H0005', modifier: 'UB_BH',    desc: 'Group Counseling — Paraprofessional',                        unit: '15min',  rate: 9.04,   lines: [T.BH_CBRS], tier: 'PARAPRO' },
  { code: 'H0047', modifier: 'UB',       desc: 'Recovery Coaching — Paraprofessional',                       unit: '15min',  rate: 9.14,   lines: [T.BH_CBRS], tier: 'PARAPRO' },
  { code: 'H0001', modifier: 'UB_BH',    desc: 'SUD Assessment & Treatment Plan — Paraprofessional',         unit: '15min',  rate: 18.34,  lines: [T.BH_CBRS, T.BH_SUD], tier: 'PARAPRO' },
  { code: 'H2015', modifier: 'BH_LS',    desc: 'Life Skills, Individual — Paraprofessional',                 unit: '15min',  rate: 6.30,   lines: [T.BH_CBRS], tier: 'PARAPRO' },
  { code: 'H2015', modifier: 'BH_LS_HQ', desc: 'Life Skills, Group — Paraprofessional',                      unit: '15min',  rate: 3.78,   lines: [T.BH_CBRS], tier: 'PARAPRO' },
  { code: 'T1017', modifier: '',         desc: 'Case Management, BH (full)',                                 unit: '15min',  rate: 17.17,  lines: [T.BH_CBRS] },
  { code: 'H0038', modifier: 'HB',       desc: 'Adult Peer Support',                                         unit: '15min',  rate: 14.15,  lines: [T.BH_CBRS], note: 'Age 18+' },
  { code: 'H0038', modifier: 'HB_HQ',    desc: 'Adult Peer Support — Group',                                 unit: '15min',  rate: 7.08,   lines: [T.BH_CBRS], note: 'Age 18+' },
  { code: 'H0038', modifier: 'HA_UB',    desc: 'Youth Support',                                              unit: '15min',  rate: 14.15,  lines: [T.BH_CBRS], note: 'Age 12-17, paraprofessional' },
  { code: 'H0038', modifier: 'HF_UB',    desc: 'Family Support',                                             unit: '15min',  rate: 14.15,  lines: [T.BH_CBRS], note: 'Age 18+, paraprofessional' },

  // ═════════════════════════════════════════════════════════════════
  // BH_CHILDRENS_IHCBS — Children's IHCBS / TASSP (Magellan)
  // ═════════════════════════════════════════════════════════════════
  // Children's CFT Interdisciplinary Team Meeting
  { code: 'G9007', modifier: 'CFT',      desc: 'CFT Interdisciplinary Team Meeting',                         unit: '15min',  rate: 30.69,  lines: [T.BH_CHILDRENS_IHCBS], tier: 'PHYSICIAN', note: 'Age 0-17' },
  { code: 'G9007', modifier: 'CFT',      desc: 'CFT Interdisciplinary Team Meeting',                         unit: '15min',  rate: 22.96,  lines: [T.BH_CHILDRENS_IHCBS], tier: 'MED_PSYCH', note: 'Age 0-17' },
  { code: 'G9007', modifier: 'HN_CFT',   desc: 'CFT — Bachelor\'s level',                                    unit: '15min',  rate: 13.48,  lines: [T.BH_CHILDRENS_IHCBS], tier: 'PARAPRO' },
  { code: 'G9007', modifier: 'HM_CFT',   desc: 'CFT — Less than Bachelor\'s',                                unit: '15min',  rate: 7.47,   lines: [T.BH_CHILDRENS_IHCBS], tier: 'PARAPRO' },
  // CANS Functional Assessment
  { code: 'H1011', modifier: 'CANS',     desc: 'CANS Functional Assessment',                                 unit: '15min',  rate: 30.69,  lines: [T.BH_CHILDRENS_IHCBS], tier: 'PHYSICIAN', note: 'Age 0-17' },
  { code: 'H1011', modifier: 'CANS',     desc: 'CANS Functional Assessment',                                 unit: '15min',  rate: 22.96,  lines: [T.BH_CHILDRENS_IHCBS], tier: 'MED_PSYCH', note: 'Age 0-17' },
  { code: 'H1011', modifier: 'HN_CANS',  desc: 'CANS — Bachelor\'s level',                                   unit: '15min',  rate: 14.65,  lines: [T.BH_CHILDRENS_IHCBS], tier: 'PARAPRO' },
  // IHCBS modalities (TBS / FFT / MDFT / MST / Other EBP)
  { code: 'H0036', modifier: 'U5',       desc: 'IHCBS Therapeutic Behavioral Services (TBS)',                unit: '15min',  rate: 44.39,  lines: [T.BH_CHILDRENS_IHCBS], tier: 'PHYSICIAN' },
  { code: 'H0036', modifier: 'U5',       desc: 'IHCBS Therapeutic Behavioral Services (TBS)',                unit: '15min',  rate: 39.76,  lines: [T.BH_CHILDRENS_IHCBS], tier: 'MED_PSYCH' },
  { code: 'H0036', modifier: 'U5_HN',    desc: 'IHCBS TBS — Bachelor\'s',                                    unit: '15min',  rate: 23.96,  lines: [T.BH_CHILDRENS_IHCBS], tier: 'PARAPRO' },
  { code: 'H0036', modifier: 'U7',       desc: 'IHCBS Functional Family Therapy (FFT)',                      unit: '15min',  rate: 44.39,  lines: [T.BH_CHILDRENS_IHCBS], tier: 'PHYSICIAN' },
  { code: 'H0036', modifier: 'U7',       desc: 'IHCBS Functional Family Therapy (FFT)',                      unit: '15min',  rate: 39.76,  lines: [T.BH_CHILDRENS_IHCBS], tier: 'MED_PSYCH' },
  { code: 'H0036', modifier: 'U8',       desc: 'IHCBS Multidimensional Family Therapy (MDFT)',               unit: '15min',  rate: 44.39,  lines: [T.BH_CHILDRENS_IHCBS], tier: 'PHYSICIAN' },
  { code: 'H0036', modifier: 'U8',       desc: 'IHCBS Multidimensional Family Therapy (MDFT)',               unit: '15min',  rate: 39.76,  lines: [T.BH_CHILDRENS_IHCBS], tier: 'MED_PSYCH' },
  { code: 'H0036', modifier: 'U9',       desc: 'IHCBS Other Evidence-Based Practice modalities',             unit: '15min',  rate: 44.39,  lines: [T.BH_CHILDRENS_IHCBS], tier: 'PHYSICIAN' },
  { code: 'H2033', modifier: '',         desc: 'IHCBS Multisystemic Therapy (MST)',                          unit: '15min',  rate: 44.94,  lines: [T.BH_CHILDRENS_IHCBS], tier: 'PHYSICIAN', note: 'Requires MST Inc certification' },
  { code: 'H2033', modifier: 'HN',       desc: 'IHCBS MST — Bachelor\'s',                                    unit: '15min',  rate: 30.24,  lines: [T.BH_CHILDRENS_IHCBS], tier: 'PARAPRO' },
  // TASSP — psychotherapy w/ UC modifier (subset)
  { code: '90832', modifier: 'UC',       desc: 'TASSP Psychotherapy 30 min',                                 unit: 'visit',  rate: 84.71,  lines: [T.BH_CHILDRENS_IHCBS], tier: 'PHYSICIAN' },
  { code: '90834', modifier: 'UC',       desc: 'TASSP Psychotherapy 45 min',                                 unit: 'visit',  rate: 110.47, lines: [T.BH_CHILDRENS_IHCBS], tier: 'PHYSICIAN' },
  { code: '90837', modifier: 'UC',       desc: 'TASSP Psychotherapy 60 min',                                 unit: 'visit',  rate: 140.81, lines: [T.BH_CHILDRENS_IHCBS], tier: 'PHYSICIAN' },

  // ═════════════════════════════════════════════════════════════════
  // BH_SUD — Substance Use Disorder
  // ═════════════════════════════════════════════════════════════════
  { code: 'H0001', modifier: 'HF',       desc: 'SUD Assessment & Treatment Plan',                            unit: '15min',  rate: null,   lines: [T.BH_SUD], note: 'Manually priced per Magellan contract' },
  { code: 'H0004', modifier: 'HF',       desc: 'SUD Individual Counseling',                                  unit: '15min',  rate: null,   lines: [T.BH_SUD] },
  { code: 'H0005', modifier: 'HF',       desc: 'SUD Group Counseling',                                       unit: '15min',  rate: null,   lines: [T.BH_SUD] },
  { code: 'H0006', modifier: 'HF',       desc: 'SUD Case Management',                                        unit: '15min',  rate: null,   lines: [T.BH_SUD] },
  { code: 'H0006', modifier: 'HS_HF',    desc: 'SUD Case Mgmt — Family w/o client present',                  unit: '15min',  rate: null,   lines: [T.BH_SUD] },
  { code: 'G2067', modifier: '',         desc: 'MAT Methadone — weekly bundle (admin + counsel + tox)',      unit: 'visit',  rate: null,   lines: [T.BH_SUD], note: 'Age 18+' },
  { code: 'G2068', modifier: '',         desc: 'MAT Buprenorphine (oral) — weekly bundle',                   unit: 'visit',  rate: null,   lines: [T.BH_SUD], note: 'Age 18+' },
  { code: 'G2074', modifier: '',         desc: 'MAT — weekly bundle excluding drug',                         unit: 'visit',  rate: null,   lines: [T.BH_SUD] },
  { code: 'H0008', modifier: '',         desc: 'Adult Social Detox (ASAM 3.2) per diem',                     unit: 'day',    rate: null,   lines: [T.BH_SUD] },
  { code: 'H0010', modifier: '',         desc: 'Adult SUD Residential High-Intensity (ASAM 3.3) per diem',   unit: 'day',    rate: null,   lines: [T.BH_SUD] },
  { code: 'H0017', modifier: 'SUD',      desc: 'SUD Subacute Care Level 3.5 per diem',                       unit: 'day',    rate: null,   lines: [T.BH_SUD] },
  { code: 'H0018', modifier: '',         desc: 'Adult Halfway House (ASAM 3.1) per diem',                    unit: 'day',    rate: null,   lines: [T.BH_SUD] },
  { code: 'H0043', modifier: '',         desc: 'Adolescent Transitional (ASAM 3.1) per diem',                unit: 'day',    rate: null,   lines: [T.BH_SUD] },
  { code: 'H0015', modifier: 'SUD',      desc: 'PHP SUD (ASAM 2.5) per diem (full day)',                     unit: 'day',    rate: null,   lines: [T.BH_SUD, T.BH_DAY_TREATMENT] },
  { code: 'H0017', modifier: 'IOP_SUD',  desc: 'IOP SUD (ASAM 2.1) per diem',                                unit: 'day',    rate: null,   lines: [T.BH_SUD, T.BH_DAY_TREATMENT] },

  // ═════════════════════════════════════════════════════════════════
  // BH_DAY_TREATMENT — IOP / PHP / Day Treatment
  // ═════════════════════════════════════════════════════════════════
  { code: 'H2012', modifier: '',         desc: 'Day Treatment — Mental Health (per hour)',                   unit: 'hour',   rate: 48.54,  lines: [T.BH_DAY_TREATMENT], note: '3-5 hrs/day, 4-5 days/wk' },
  { code: 'H0035', modifier: '',         desc: 'PHP Mental Health (full day, 6+ hrs)',                       unit: 'day',    rate: null,   lines: [T.BH_DAY_TREATMENT] },
  { code: 'S9480', modifier: '',         desc: 'IOP Psychiatric',                                            unit: 'day',    rate: null,   lines: [T.BH_DAY_TREATMENT] },
  { code: 'S9480', modifier: 'EAT',      desc: 'IOP Eating Disorder',                                        unit: 'day',    rate: null,   lines: [T.BH_DAY_TREATMENT] },
  { code: 'H0035', modifier: 'EAT',      desc: 'PHP Eating Disorder (full day)',                             unit: 'day',    rate: null,   lines: [T.BH_DAY_TREATMENT] },

  // ═════════════════════════════════════════════════════════════════
  // BH_SSH — Safe and Sober Housing
  // ═════════════════════════════════════════════════════════════════
  { code: 'H0044', modifier: '',         desc: 'Adult Safe and Sober Housing (SSH) per diem',                unit: 'day',    rate: null,   lines: [T.BH_SSH], note: 'Age 18+; manually priced' },
  { code: 'H0044', modifier: 'SE',       desc: 'Adult Enhanced SSH (incl program fees) per diem',            unit: 'day',    rate: null,   lines: [T.BH_SSH] },
  { code: 'H0044', modifier: 'HF',       desc: 'Adult SSH Program Fees',                                     unit: 'day',    rate: null,   lines: [T.BH_SSH] },
  { code: 'S5199', modifier: '',         desc: 'Basic Housing Essentials',                                   unit: 'one_time', rate: null, lines: [T.BH_SSH], note: 'Up to $125 per treatment episode' },

  // ═════════════════════════════════════════════════════════════════
  // SELF_DIRECT — Family Directed services
  // All manually priced
  // ═════════════════════════════════════════════════════════════════
  { code: 'T2025', modifier: '',         desc: 'Community Support Services — Family Directed',               unit: 'manual', rate: null,   lines: [T.SELF_DIRECT] },
  { code: 'T2040', modifier: '',         desc: 'Fiscal Employer Agent — Family Directed',                    unit: 'month',  rate: null,   lines: [T.SELF_DIRECT], note: 'PMPM, manually priced' },
  { code: 'T2041', modifier: '',         desc: 'Support Broker Services',                                    unit: '15min',  rate: null,   lines: [T.SELF_DIRECT, T.SUPPORT_BROKER], note: 'Manually priced' },

  // ═════════════════════════════════════════════════════════════════
  // Transportation (cross-cutting)
  // ═════════════════════════════════════════════════════════════════
  { code: 'A0080', modifier: 'AGENCY',   desc: 'Waiver Agency Transportation',                               unit: 'mile',   rate: 0.42,   lines: [T.AD_CASE_MGMT, T.PAA, T.ADULT_DDA] },
  { code: 'A0080', modifier: 'INDEP',    desc: 'Non-Medical Transportation — Individual',                    unit: 'mile',   rate: 0.10,   lines: [T.ADULT_DDA] },
  { code: 'A0080', modifier: 'COMM_1ST', desc: 'Commercial Transport — 1st mile of 1st trip',                unit: 'mile',   rate: 4.03,   lines: [T.AD_CASE_MGMT, T.PAA, T.ADULT_DDA] },
  { code: 'A0080', modifier: '76',       desc: 'Commercial Transport — additional miles',                    unit: 'mile',   rate: 1.12,   lines: [T.AD_CASE_MGMT, T.PAA, T.ADULT_DDA] },
];

// ──────────────────────────────────────────────────────────────────────
// HOSPICE — county-keyed per-diem matrix (Idaho, eff 10/1/2025–9/30/2026)
// Quality Data Submitted (Table 1)
// ──────────────────────────────────────────────────────────────────────
const HOSPICE_RATES_QUALITY = {
  // county: { rc0651_d1_60, rc0651_d61_plus, sia, rc0652, rc0655, rc0656 }
  'Franklin':                    { rc0651_d1_60: 223.04, rc0651_d61_plus: 175.81, sia: 268.00, rc0652: 16.75, rc0655: 542.39, rc0656: 1159.48 },
  'Kootenai':                    { rc0651_d1_60: 229.68, rc0651_d61_plus: 181.04, sia: 277.12, rc0652: 17.32, rc0655: 557.26, rc0656: 1192.62 },
  'Jerome/Twin Falls':           { rc0651_d1_60: 221.17, rc0651_d61_plus: 174.33, sia: 265.44, rc0652: 16.59, rc0655: 538.18, rc0656: 1150.11 },
  'Nez Perce':                   { rc0651_d1_60: 215.65, rc0651_d61_plus: 169.98, sia: 257.92, rc0652: 16.12, rc0655: 525.81, rc0656: 1122.53 },
  'Bannock/Power':               { rc0651_d1_60: 212.81, rc0651_d61_plus: 167.74, sia: 253.92, rc0652: 15.87, rc0655: 519.45, rc0656: 1108.35 },
  'Bonneville/Butte/Jefferson':  { rc0651_d1_60: 200.76, rc0651_d61_plus: 158.24, sia: 237.44, rc0652: 14.84, rc0655: 492.44, rc0656: 1048.16 },
  'Ada/Boise/Canyon/Gem/Owyhee': { rc0651_d1_60: 226.39, rc0651_d61_plus: 178.44, sia: 272.64, rc0652: 17.04, rc0655: 549.88, rc0656: 1176.16 },
  'RURAL':                       { rc0651_d1_60: 196.85, rc0651_d61_plus: 155.16, sia: 232.00, rc0652: 14.50, rc0655: 483.68, rc0656: 1028.66 },
};

const HOSPICE_RATES_NO_QUALITY = {
  'Franklin':                    { rc0651_d1_60: 214.35, rc0651_d61_plus: 168.95, sia: 257.60, rc0652: 16.10, rc0655: 521.24, rc0656: 1114.27 },
  'Kootenai':                    { rc0651_d1_60: 220.73, rc0651_d61_plus: 173.97, sia: 266.40, rc0652: 16.65, rc0655: 535.53, rc0656: 1146.12 },
  'Jerome/Twin Falls':           { rc0651_d1_60: 212.55, rc0651_d61_plus: 167.53, sia: 255.04, rc0652: 15.94, rc0655: 517.19, rc0656: 1105.27 },
  'Nez Perce':                   { rc0651_d1_60: 207.24, rc0651_d61_plus: 163.34, sia: 247.84, rc0652: 15.49, rc0655: 505.30, rc0656: 1078.76 },
  'Bannock/Power':               { rc0651_d1_60: 204.51, rc0651_d61_plus: 161.19, sia: 244.00, rc0652: 15.25, rc0655: 499.19, rc0656: 1065.14 },
  'Bonneville/Butte/Jefferson':  { rc0651_d1_60: 192.93, rc0651_d61_plus: 152.07, sia: 228.16, rc0652: 14.26, rc0655: 473.23, rc0656: 1007.30 },
  'Ada/Boise/Canyon/Gem/Owyhee': { rc0651_d1_60: 217.56, rc0651_d61_plus: 171.48, sia: 262.08, rc0652: 16.38, rc0655: 528.43, rc0656: 1130.31 },
  'RURAL':                       { rc0651_d1_60: 189.18, rc0651_d61_plus: 149.11, sia: 222.88, rc0652: 13.93, rc0655: 464.82, rc0656: 988.55 },
};

export const HOSPICE_COUNTIES = Object.keys(HOSPICE_RATES_QUALITY);
export const HOSPICE_CAP_2026 = 35361.44;  // Cap year ending 9/30/2026

export function getHospiceRate(county, qualityDataSubmitted = true) {
  const table = qualityDataSubmitted ? HOSPICE_RATES_QUALITY : HOSPICE_RATES_NO_QUALITY;
  return table[county] || table['RURAL'];
}

// ──────────────────────────────────────────────────────────────────────
// Catalog object + query helpers
// ──────────────────────────────────────────────────────────────────────
export const IDAHO_RATES = {
  effectiveDate:   '2025-09-01',
  bhEffectiveDate: '2026-04-13',
  hospiceEffective: '2025-10-01',
  source: 'Idaho Medicaid Fee Schedules (post-9/1/2025 reduction) + Magellan IBHP (4/13/2026)',
  rates: RATES,
};

/**
 * Get all rate records that apply to a given service line type.
 */
export function ratesForLine(serviceLineType) {
  return RATES.filter(r => r.lines.includes(serviceLineType));
}

/**
 * Find a single rate by code + modifier (+ optional tier).
 * Returns null if no match.
 */
export function findRate(code, modifier = '', tier = null) {
  return RATES.find(r =>
    r.code === code &&
    r.modifier === modifier &&
    (tier === null || r.tier === tier)
  ) || null;
}

/**
 * Resolve a rate for a service line, with optional licensee override.
 *
 * `overrides` is an optional map of "code|modifier|tier" → number that the
 * licensee has set on the service line config. If the resolved key is in
 * overrides, the override wins. Otherwise the catalog rate is used.
 */
export function resolveRate(serviceLineType, code, modifier = '', tier = null, overrides = {}) {
  const key = `${code}|${modifier}|${tier ?? ''}`;
  if (key in overrides) return overrides[key];
  const rec = RATES.find(r =>
    r.code === code &&
    r.modifier === modifier &&
    (tier === null || r.tier === tier) &&
    r.lines.includes(serviceLineType)
  );
  return rec ? rec.rate : null;
}

/**
 * Convert hourly figures to billable-units for a given unit type.
 * Handy when calculators need to translate "2 hours of service" into units.
 */
export function unitsFromHours(hours, unit) {
  switch (unit) {
    case '15min': return hours * 4;
    case 'hour':  return hours;
    case 'day':   return hours / 24;
    default:      return hours;
  }
}

export function hoursFromUnits(units, unit) {
  switch (unit) {
    case '15min': return units / 4;
    case 'hour':  return units;
    case 'day':   return units * 24;
    default:      return units;
  }
}
