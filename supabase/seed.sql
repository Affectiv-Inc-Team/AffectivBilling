-- Default company — mirrors createEmptyConfig() / createSharedConfig() from companyShape.js.
-- Inserted on every db reset so local dev always has a company to work with.
-- The remote project can be seeded by running this file in the Supabase SQL editor.

insert into public.companies (id, name, archived, config)
values (
  'co_default1',
  'My Company',
  false,
  '{
    "shared": {
      "wage": 16,
      "graveyardWage": 9.5,
      "occupancy": 95,
      "entityType": "ccorp",
      "ownerRate": 32,
      "mgmtFeePct": 5,
      "billingFeePct": 1,
      "rates": {
        "intenseDaily": 678.77,
        "highDaily": 368.67,
        "iuUnit": 7.07,
        "igUnit": 3.61
      },
      "mgmt": [],
      "overhead": [],
      "sharedOverhead": {
        "fixedAnnual": 0,
        "perHomePerMonth": 0,
        "perParticipantPerMonth": 0,
        "perCoordinatorPerMonth": 0
      },
      "allocationMethod": "revenue"
    },
    "serviceLines": []
  }'
)
on conflict (id) do nothing;
