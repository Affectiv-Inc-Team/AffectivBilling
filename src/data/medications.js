// Curated medication name list for autocomplete on the referral intake form.
//
// This is a LOCAL reference list (no external/network lookup) — deliberately so,
// to avoid sending a participant's medication list to a third-party API (PHI).
// It leans toward the psychotropic / anticonvulsant / behavioral-support meds
// most relevant to IDD/HCBS intake, plus common general meds. Generic names with
// a common brand in parentheses where helpful. Expand as real usage surfaces it;
// docs/referral-integration-plan.md describes wiring a true drug database (RxNorm)
// behind this same field later.

export const COMMON_MEDICATIONS = [
  // Antipsychotics
  "Aripiprazole (Abilify)",
  "Risperidone (Risperdal)",
  "Quetiapine (Seroquel)",
  "Olanzapine (Zyprexa)",
  "Ziprasidone (Geodon)",
  "Haloperidol (Haldol)",
  "Clozapine (Clozaril)",
  "Paliperidone (Invega)",
  "Lurasidone (Latuda)",
  // Mood stabilizers / anticonvulsants
  "Valproic acid / Divalproex (Depakote)",
  "Lithium",
  "Lamotrigine (Lamictal)",
  "Carbamazepine (Tegretol)",
  "Oxcarbazepine (Trileptal)",
  "Levetiracetam (Keppra)",
  "Topiramate (Topamax)",
  "Gabapentin (Neurontin)",
  "Phenytoin (Dilantin)",
  "Clonazepam (Klonopin)",
  "Lorazepam (Ativan)",
  "Diazepam (Valium)",
  // Antidepressants
  "Sertraline (Zoloft)",
  "Fluoxetine (Prozac)",
  "Escitalopram (Lexapro)",
  "Citalopram (Celexa)",
  "Paroxetine (Paxil)",
  "Venlafaxine (Effexor)",
  "Duloxetine (Cymbalta)",
  "Bupropion (Wellbutrin)",
  "Mirtazapine (Remeron)",
  "Trazodone (Desyrel)",
  // ADHD / stimulants & alpha-agonists
  "Methylphenidate (Ritalin / Concerta)",
  "Amphetamine/Dextroamphetamine (Adderall)",
  "Lisdexamfetamine (Vyvanse)",
  "Atomoxetine (Strattera)",
  "Guanfacine (Intuniv / Tenex)",
  "Clonidine (Catapres / Kapvay)",
  // Anxiolytics / other behavioral
  "Buspirone (Buspar)",
  "Propranolol (Inderal)",
  "Naltrexone",
  "Melatonin",
  "Hydroxyzine (Vistaril / Atarax)",
  // Common general / comorbidity meds
  "Levothyroxine (Synthroid)",
  "Metformin",
  "Lisinopril",
  "Amlodipine",
  "Atorvastatin (Lipitor)",
  "Omeprazole (Prilosec)",
  "Albuterol (Ventolin / ProAir)",
  "Acetaminophen (Tylenol)",
  "Ibuprofen (Advil / Motrin)",
  "Docusate (Colace)",
  "Polyethylene glycol (Miralax)",
  "Vitamin D",
  "Multivitamin",
];

// Common dosing-frequency shorthands (free text still allowed).
export const MEDICATION_FREQUENCIES = [
  "Once daily (QD)",
  "Twice daily (BID)",
  "Three times daily (TID)",
  "Four times daily (QID)",
  "Every morning (QAM)",
  "Every night (QHS)",
  "As needed (PRN)",
  "Weekly",
  "Every other day",
];
