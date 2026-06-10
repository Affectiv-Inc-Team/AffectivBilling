import { describe, it, expect } from "vitest";
import {
  SERVICE_LINE_TYPES,
  SERVICE_LINE_DEFS,
  ARCHETYPES,
  getActiveTypes,
  getPickableTypes,
  getDefaultConfig,
  getGroupedPickerOptions,
  getTypesByArchetype,
  getLabel,
  getShortLabel,
  getDef,
  TYPE_LIST,
} from "../types.js";

// ──────────────────────────────────────────────────────────────────────
// SERVICE_LINE_TYPES registry
// ──────────────────────────────────────────────────────────────────────

describe("SERVICE_LINE_TYPES", () => {
  it("contains all 27 expected types", () => {
    expect(Object.keys(SERVICE_LINE_TYPES)).toHaveLength(27);
  });

  it("each value equals its key (string enum pattern)", () => {
    for (const [k, v] of Object.entries(SERVICE_LINE_TYPES)) {
      expect(v).toBe(k);
    }
  });

  it("includes the three active types", () => {
    expect(SERVICE_LINE_TYPES.RES_HAB_DAILY).toBe("RES_HAB_DAILY");
    expect(SERVICE_LINE_TYPES.RES_HAB_HOURLY).toBe("RES_HAB_HOURLY");
    expect(SERVICE_LINE_TYPES.TSC).toBe("TSC");
  });
});

// ──────────────────────────────────────────────────────────────────────
// getActiveTypes
// ──────────────────────────────────────────────────────────────────────

describe("getActiveTypes", () => {
  it("returns exactly 6 types", () => {
    expect(getActiveTypes()).toHaveLength(6);
  });

  it("returns RES_HAB_DAILY", () => {
    expect(getActiveTypes()).toContain("RES_HAB_DAILY");
  });

  it("returns RES_HAB_HOURLY", () => {
    expect(getActiveTypes()).toContain("RES_HAB_HOURLY");
  });

  it("returns TSC", () => {
    expect(getActiveTypes()).toContain("TSC");
  });

  it("returns VOC_SERVICES", () => {
    expect(getActiveTypes()).toContain("VOC_SERVICES");
  });

  it("returns CHILDRENS_DDA", () => {
    expect(getActiveTypes()).toContain("CHILDRENS_DDA");
  });

  it("returns SCHOOL_BASED", () => {
    expect(getActiveTypes()).toContain("SCHOOL_BASED");
  });

  it("every returned type has status 'active' in SERVICE_LINE_DEFS", () => {
    for (const t of getActiveTypes()) {
      expect(SERVICE_LINE_DEFS[t].status).toBe("active");
    }
  });
});

// ──────────────────────────────────────────────────────────────────────
// getPickableTypes
// ──────────────────────────────────────────────────────────────────────

describe("getPickableTypes", () => {
  it("includes all active types", () => {
    const pickable = getPickableTypes();
    expect(pickable).toContain("RES_HAB_DAILY");
    expect(pickable).toContain("RES_HAB_HOURLY");
    expect(pickable).toContain("TSC");
  });

  it("does not contain any type with status 'planned'", () => {
    const pickable = getPickableTypes();
    const plannedTypes = TYPE_LIST.filter(
      (t) => SERVICE_LINE_DEFS[t].status === "planned"
    );
    for (const t of plannedTypes) {
      expect(pickable).not.toContain(t);
    }
  });

  it("every returned type has status 'active' or 'catalog'", () => {
    for (const t of getPickableTypes()) {
      const status = SERVICE_LINE_DEFS[t].status;
      expect(["active", "catalog"]).toContain(status);
    }
  });

  it("returns at least as many types as getActiveTypes", () => {
    expect(getPickableTypes().length).toBeGreaterThanOrEqual(getActiveTypes().length);
  });
});

// ──────────────────────────────────────────────────────────────────────
// getDefaultConfig
// ──────────────────────────────────────────────────────────────────────

describe("getDefaultConfig", () => {
  it("TSC default config has coordinators as empty array", () => {
    const cfg = getDefaultConfig("TSC");
    expect(Array.isArray(cfg.coordinators)).toBe(true);
    expect(cfg.coordinators).toHaveLength(0);
  });

  it("RES_HAB_DAILY default config has homes as array", () => {
    const cfg = getDefaultConfig("RES_HAB_DAILY");
    expect(Array.isArray(cfg.indHomes)).toBe(true);
  });

  it("RES_HAB_HOURLY default config has participants as array", () => {
    const cfg = getDefaultConfig("RES_HAB_HOURLY");
    expect(Array.isArray(cfg.participants)).toBe(true);
  });

  it("SCHOOL_BASED default config has clinicians array and school year", () => {
    const cfg = getDefaultConfig("SCHOOL_BASED");
    expect(Array.isArray(cfg.clinicians)).toBe(true);
    expect(cfg.clinicians).toHaveLength(0);
    expect(cfg.schoolYear.weeksPerYear).toBe(36);
  });

  it("returns empty object for unknown type without throwing", () => {
    expect(() => getDefaultConfig("UNKNOWN_TYPE")).not.toThrow();
    expect(getDefaultConfig("UNKNOWN_TYPE")).toEqual({});
  });

  it("returns a new object on each call (not shared reference)", () => {
    const a = getDefaultConfig("TSC");
    const b = getDefaultConfig("TSC");
    expect(a).not.toBe(b);
  });

  it("every known type returns a non-null object", () => {
    for (const type of TYPE_LIST) {
      const cfg = getDefaultConfig(type);
      expect(cfg).toBeDefined();
      expect(typeof cfg).toBe("object");
    }
  });
});

// ──────────────────────────────────────────────────────────────────────
// getGroupedPickerOptions
// ──────────────────────────────────────────────────────────────────────

describe("getGroupedPickerOptions", () => {
  it("returns an array with at least one group", () => {
    const groups = getGroupedPickerOptions();
    expect(Array.isArray(groups)).toBe(true);
    expect(groups.length).toBeGreaterThan(0);
  });

  it("each group has archetype, label, and types properties", () => {
    for (const g of getGroupedPickerOptions()) {
      expect(g).toHaveProperty("archetype");
      expect(g).toHaveProperty("label");
      expect(Array.isArray(g.types)).toBe(true);
    }
  });

  it("TSC appears in the CASELOAD_COORDINATOR archetype group", () => {
    const groups = getGroupedPickerOptions();
    const caseloadGroup = groups.find(
      (g) => g.archetype === ARCHETYPES.CASELOAD_COORDINATOR
    );
    expect(caseloadGroup).toBeDefined();
    expect(caseloadGroup.types.map((t) => t.type)).toContain("TSC");
  });

  it("RES_HAB_DAILY appears in the PER_DIEM_RESIDENTIAL group", () => {
    const groups = getGroupedPickerOptions();
    const group = groups.find(
      (g) => g.archetype === ARCHETYPES.PER_DIEM_RESIDENTIAL
    );
    expect(group).toBeDefined();
    expect(group.types.map((t) => t.type)).toContain("RES_HAB_DAILY");
  });

  it("SCHOOL_BASED appears in the MIXED_MODALITY group with active status", () => {
    const groups = getGroupedPickerOptions();
    const group = groups.find(
      (g) => g.archetype === ARCHETYPES.MIXED_MODALITY
    );
    expect(group).toBeDefined();
    const school = group.types.find((t) => t.type === "SCHOOL_BASED");
    expect(school).toBeDefined();
    expect(school.status).toBe("active");
  });

  it("each type entry has type, label, shortLabel, description, and status", () => {
    for (const g of getGroupedPickerOptions()) {
      for (const t of g.types) {
        expect(t).toHaveProperty("type");
        expect(t).toHaveProperty("label");
        expect(t).toHaveProperty("shortLabel");
        expect(t).toHaveProperty("description");
        expect(t).toHaveProperty("status");
      }
    }
  });

  it("does not include any planned types in any group", () => {
    const allTypesInGroups = getGroupedPickerOptions().flatMap((g) =>
      g.types.map((t) => t.type)
    );
    const plannedTypes = TYPE_LIST.filter(
      (t) => SERVICE_LINE_DEFS[t].status === "planned"
    );
    for (const t of plannedTypes) {
      expect(allTypesInGroups).not.toContain(t);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────
// getTypesByArchetype
// ──────────────────────────────────────────────────────────────────────

describe("getTypesByArchetype", () => {
  it("returns TSC for CASELOAD_COORDINATOR archetype", () => {
    const types = getTypesByArchetype(ARCHETYPES.CASELOAD_COORDINATOR);
    expect(types).toContain("TSC");
  });

  it("all returned types belong to the requested archetype", () => {
    const archetype = ARCHETYPES.PER_DIEM_RESIDENTIAL;
    for (const t of getTypesByArchetype(archetype)) {
      expect(SERVICE_LINE_DEFS[t].archetype).toBe(archetype);
    }
  });

  it("returns empty array for unknown archetype", () => {
    expect(getTypesByArchetype("FAKE_ARCHETYPE")).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Label helpers
// ──────────────────────────────────────────────────────────────────────

describe("getLabel / getShortLabel / getDef", () => {
  it("getLabel returns the full label for TSC", () => {
    expect(getLabel("TSC")).toBe("Targeted Service Coordination");
  });

  it("getLabel falls back to the type string for unknown types", () => {
    expect(getLabel("UNKNOWN")).toBe("UNKNOWN");
  });

  it("getShortLabel returns the abbreviated label for TSC", () => {
    expect(getShortLabel("TSC")).toBe("TSC");
  });

  it("getShortLabel returns short label for RES_HAB_DAILY", () => {
    expect(getShortLabel("RES_HAB_DAILY")).toBe("Res Hab Daily");
  });

  it("getDef returns the full definition for a known type", () => {
    const def = getDef("TSC");
    expect(def).not.toBeNull();
    expect(def.status).toBe("active");
    expect(def.archetype).toBe(ARCHETYPES.CASELOAD_COORDINATOR);
  });

  it("getDef returns null for an unknown type", () => {
    expect(getDef("UNKNOWN")).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────
// SERVICE_LINE_DEFS structural integrity
// ──────────────────────────────────────────────────────────────────────

describe("SERVICE_LINE_DEFS structural integrity", () => {
  it("every defined type has label, shortLabel, archetype, billingUnit, status, defaultConfig", () => {
    for (const [type, def] of Object.entries(SERVICE_LINE_DEFS)) {
      expect(def.label, `${type}.label`).toBeTruthy();
      expect(def.shortLabel, `${type}.shortLabel`).toBeTruthy();
      expect(def.archetype, `${type}.archetype`).toBeTruthy();
      expect(def.billingUnit, `${type}.billingUnit`).toBeTruthy();
      expect(["active", "catalog", "planned"], `${type}.status`).toContain(def.status);
      expect(typeof def.defaultConfig, `${type}.defaultConfig`).toBe("function");
    }
  });

  it("every type's archetype is a known ARCHETYPES value", () => {
    const knownArchetypes = new Set(Object.values(ARCHETYPES));
    for (const [type, def] of Object.entries(SERVICE_LINE_DEFS)) {
      expect(knownArchetypes.has(def.archetype), `${type}.archetype unknown`).toBe(true);
    }
  });
});
