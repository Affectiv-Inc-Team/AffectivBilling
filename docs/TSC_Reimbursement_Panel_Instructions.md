# Detailed Instructions for Agentic Coder: Build Reimbursement Rate Side Panel for TSC

## Project Overview
Build a reimbursement rate configuration side panel for Targeted Service Coordination (TSC) services. This panel should match the design and functionality of an existing "Res Hab Daily" interface and provide a comprehensive UI for managing billing code configurations, rate adjustments, and unit cap enforcement.

The existing system already includes all rate calculations and billing code definitions. Your task is to create the UI layer to display and manage these configurations.

---

## Core Requirements

### 1. Design and Layout
- **Requirement**: Create a side panel interface that matches the visual design and information architecture of the "Res Hab Daily" panel
- **Key Elements**:
  - Side panel container (typically 300-400px wide)
  - Clean, organized sections for different configuration areas
  - Consistent styling with existing design system
  - Responsive behavior that doesn't break on different screen sizes
  - Proper spacing, typography, and color consistency with Res Hab Daily
- **Deliverable**: Complete HTML/CSS markup matching Res Hab Daily's design language
- **Reference**: Check `/docs/design-system.md` and `/docs/res-hab-daily-design.md` for design specifications

### 2. Billing Code Configuration - G9007
- **Requirement**: Display and manage configuration UI for G9007 billing code
- **Specifications**:
  - Display current G9007 code settings and description
  - Show G9007 rate information (reference from system)
  - Enable/disable toggle for G9007 in this service context
  - Display rate in currency format
  - Show unit duration basis (15 minutes)
  - Configuration validation UI (non-editable - references existing system data)
- **Reference Data**: See `/docs/billing-codes/g9007.md` for G9007 specifications
- **Expected Behavior**: Users can enable/disable G9007 and view its rate; system uses existing G9007 rate calculations

### 3. Billing Code Configuration - G9002
- **Requirement**: Display and manage configuration UI for G9002 billing code
- **Specifications**:
  - Display current G9002 code settings and description
  - Show G9002 rate information (reference from system)
  - Enable/disable toggle for G9002 in this service context
  - Display rate in currency format
  - Show unit duration basis (15 minutes)
  - Configuration validation UI (non-editable - references existing system data)
- **Reference Data**: See `/docs/billing-codes/g9002.md` for G9002 specifications
- **Expected Behavior**: Users can enable/disable G9002 and view its rate; system uses existing G9002 rate calculations

### 4. Unit Caps Display and Enforcement
- **Service Coordination Unit Cap**: 18 units/month
  - Display current month unit usage counter
  - Show remaining units available for service coordination
  - Visual indicator when approaching limit (warning at 15+ units)
  - UI element displaying: "Service Coordination: X/18 units used this month"
  - Note: Cap enforcement is handled by existing system, UI is for display only
  - Reference: `/docs/unit-caps/service-coordination-caps.md`

- **Planned Development Unit Cap**: 48 units/year
  - Display current year unit usage counter
  - Show remaining units available for planned development
  - Visual indicator when approaching limit (warning at 40+ units)
  - UI element displaying: "Planned Development: X/48 units used this year"
  - Note: Cap enforcement is handled by existing system, UI is for display only
  - Reference: `/docs/unit-caps/planned-development-caps.md`

### 5. Rate Adjustment Controls
- **Requirement**: Allow users to adjust reimbursement rates within configured service context
- **Specifications**:
  - Rate adjustment slider or input field (percentage-based)
  - Preview the adjusted rate before applying (e.g., "Base Rate: $50 → Adjusted: $55 (+10%)")
  - Apply/Cancel buttons to save or discard adjustments
  - Show adjustment metadata (who adjusted, when, why - optional notes field)
  - Validation to ensure rates stay within acceptable system ranges
  - Display both base rate and effective rate after adjustment
- **Integration**: Adjustments integrate with existing system rate calculations
- **Expected Behavior**: When applied, all billing calculations automatically use the adjusted rate
- **Reference**: `/docs/rate-management/adjustment-guidelines.md`

### 6. 15-Minute Unit Duration Display
- **Requirement**: Show and display unit billing in 15-minute increments
- **Specifications**:
  - Display unit duration as "15 minutes" or "0.25 hours"
  - Show duration alongside each rate (e.g., "$50 per 15 minutes")
  - Display unit count for service duration (e.g., "45 minutes of service = 3 units")
  - Show conversion examples for clarity
  - Note: Rounding and calculations are handled by existing system
- **Expected Behavior**: All rates and usage are displayed with 15-minute unit basis
- **Reference**: `/docs/unit-duration/15-minute-units.md`

### 7. Configuration Display and Persistence
- **Requirement**: Display configured settings persistently
- **Specifications**:
  - Load current configuration on panel open
  - Display all settings in a clear, organized manner
  - Save user changes to local state and existing system
  - Refresh configuration from system on demand
  - Handle loading states while fetching configuration
  - Show last updated timestamp for configuration
- **Data Persistence**: Uses existing system persistence (not localStorage)
- **Expected Behavior**: Settings remain consistent across page refreshes and sessions

### 8. Billing Calculation Display Verification
- **Requirement**: Display accurate billing information based on configured rates
- **Specifications**:
  - Show example calculations based on current configuration
  - Display how different service durations (15 min, 30 min, 45 min, 60 min, etc.) translate to units
  - Show rate application (e.g., "2 units × $50/unit = $100")
  - Display unit cap impact on billing (how many units can be billed before cap is reached)
  - Show totals with configured rates applied
- **Note**: The calculation engine is part of existing system; this is display/verification UI
- **Reference**: `/docs/calculations/billing-calculation-logic.md`

---

## Technical Architecture

### Frontend Components Needed
```
TSCReimbursementPanel (Main Component)
├── Header
│   ├── Title: "TSC Reimbursement Rate Configuration"
│   └── Close/Minimize Button
├── BillingCodeSection
│   ├── G9007ConfigurationCard
│   │   ├── CodeDisplay ("G9007")
│   │   ├── DescriptionDisplay
│   │   ├── RateDisplay (formatted currency)
│   │   ├── DurationDisplay ("15 minutes / 0.25 hours")
│   │   └── EnableToggle
│   └── G9002ConfigurationCard
│       ├── CodeDisplay ("G9002")
│       ├── DescriptionDisplay
│       ├── RateDisplay (formatted currency)
│       ├── DurationDisplay ("15 minutes / 0.25 hours")
│       └── EnableToggle
├── UnitCapsSection
│   ├── ServiceCoordinationCapDisplay
│   │   ├── CapLabel ("Service Coordination Cap")
│   │   ├── UsageCounter ("X / 18 units used this month")
│   │   ├── ProgressBar (visual indicator)
│   │   └── WarningIndicator (if > 15 units)
│   └── PlannedDevelopmentCapDisplay
│       ├── CapLabel ("Planned Development Cap")
│       ├── UsageCounter ("X / 48 units used this year")
│       ├── ProgressBar (visual indicator)
│       └── WarningIndicator (if > 40 units)
├── RateAdjustmentSection
│   ├── BaseRateDisplay
│   ├── AdjustmentControls
│   │   ├── PercentageSlider (-50% to +50%)
│   │   ├── PercentageInput
│   │   └── ClearAdjustmentButton
│   ├── PreviewDisplay
│   │   ├── CalculatedAdjustedRate
│   │   └── ComparisonWithBase ("$50 → $55 (+10%)")
│   ├── AdjustmentNotes (optional)
│   ├── ApplyButton
│   └── CancelButton
├── UnitDurationSection
│   ├── CurrentDurationDisplay ("15 minutes per unit")
│   ├── HourEquivalent ("0.25 hours per unit")
│   ├── ConversionExamples
│   │   ├── "15 min service = 1 unit"
│   │   ├── "30 min service = 2 units"
│   │   ├── "45 min service = 3 units"
│   │   └── "60 min service = 4 units"
└── ConfigurationFooter
    ├── LastUpdatedTimestamp
    └── RefreshButton
```

### Data Model
```javascript
{
  billingCodes: {
    G9007: {
      code: "G9007",
      description: string,
      baseRate: number,        // from system
      adjustmentPercentage: number,
      effectiveRate: number,   // calculated
      enabled: boolean,
      unitDuration: "15 minutes"
    },
    G9002: {
      code: "G9002",
      description: string,
      baseRate: number,        // from system
      adjustmentPercentage: number,
      effectiveRate: number,   // calculated
      enabled: boolean,
      unitDuration: "15 minutes"
    }
  },
  unitCaps: {
    serviceCoordination: {
      type: "monthly",
      limit: 18,
      currentUsage: number,
      remaining: number,
      periodStart: date,
      periodEnd: date
    },
    plannedDevelopment: {
      type: "yearly",
      limit: 48,
      currentUsage: number,
      remaining: number,
      periodStart: date,
      periodEnd: date
    }
  },
  rateAdjustments: {
    G9007AdjustmentPercent: number,
    G9002AdjustmentPercent: number,
    lastModified: date,
    modifiedBy: string,
    notes: string
  }
}
```

### Documentation File References
- `/docs/billing-codes/g9007.md` - G9007 code specifications
- `/docs/billing-codes/g9002.md` - G9002 code specifications
- `/docs/unit-caps/service-coordination-caps.md` - SC cap details
- `/docs/unit-caps/planned-development-caps.md` - PD cap details
- `/docs/unit-duration/15-minute-units.md` - Unit duration specifications
- `/docs/rate-management/adjustment-guidelines.md` - Rate adjustment rules
- `/docs/calculations/billing-calculation-logic.md` - Calculation engine details
- `/docs/design-system.md` - Overall design system guidelines
- `/docs/res-hab-daily-design.md` - Res Hab Daily design specifications

---

## Implementation Steps

### Phase 1: Foundation (Days 1-2)
1. Create side panel component structure with proper styling
2. Study Res Hab Daily design in `/docs/res-hab-daily-design.md`
3. Create matching CSS/styling for the side panel
4. Build component hierarchy and file structure
5. Set up state management for panel data

### Phase 2: Billing Code Display (Days 3-4)
1. Review G9007 specifications in `/docs/billing-codes/g9007.md`
2. Review G9002 specifications in `/docs/billing-codes/g9002.md`
3. Build G9007 configuration card component
4. Build G9002 configuration card component
5. Implement enable/disable toggles for each code
6. Integrate with existing system to load rate data

### Phase 3: Unit Caps Display (Days 5-6)
1. Review cap specifications in `/docs/unit-caps/`
2. Build Service Coordination cap display component
3. Build Planned Development cap display component
4. Implement progress bars and visual indicators
5. Connect to existing system to fetch current usage data
6. Add warning states when approaching limits

### Phase 4: Rate Adjustment UI (Days 7-8)
1. Review adjustment guidelines in `/docs/rate-management/adjustment-guidelines.md`
2. Build rate adjustment control component
3. Implement percentage slider (range -50% to +50%)
4. Create preview display showing base vs. adjusted rate
5. Add apply/cancel functionality
6. Implement adjustment notes field (optional)
7. Connect to existing system to save adjustments

### Phase 5: Unit Duration Display (Days 9)
1. Review unit duration specs in `/docs/unit-duration/15-minute-units.md`
2. Build duration display component
3. Add conversion examples (15, 30, 45, 60 minute examples)
4. Display alongside rates (e.g., "$50 per 15 minutes")
5. Ensure consistent display across all components

### Phase 6: Integration & Polish (Days 10-11)
1. Load actual rate data from existing system
2. Load actual unit cap usage from existing system
3. Test persistence of rate adjustments
4. Add loading states and error handling
5. Test responsive design on mobile/tablet/desktop
6. Optimize performance and styling

### Phase 7: Verification & Testing (Days 12-13)
1. Verify all billing codes display correctly
2. Verify unit caps show accurate usage
3. Verify rate adjustments calculate correctly
4. Verify adjusted rates are used in system calculations
5. Verify configuration persists across sessions
6. Manual testing with various scenarios
7. QA review and bug fixes

---

## Success Criteria Checklist

- ✅ Side panel UI matches Res Hab Daily design aesthetics
- ✅ G9007 billing code displayed with correct rate from system
- ✅ G9002 billing code displayed with correct rate from system
- ✅ Enable/disable toggles functional for both codes
- ✅ Service Coordination units displayed (X/18) with warning at 15+
- ✅ Planned Development units displayed (X/48) with warning at 40+
- ✅ Rate adjustment controls functional with preview
- ✅ Rate adjustments apply to system calculations
- ✅ 15-minute unit duration displayed throughout
- ✅ Conversion examples clear and accurate
- ✅ Configuration displays persist across page refresh
- ✅ Configuration displays persist across session
- ✅ All rates display in consistent currency format
- ✅ All components responsive (mobile/tablet/desktop)
- ✅ No console errors or warnings
- ✅ Proper loading states during data fetch
- ✅ Proper error handling for data failures
- ✅ Accessibility standards met (WCAG 2.1 AA)

---

## Key Notes for Agentic Coder

1. **No API Implementation**: Do NOT create or implement API endpoints. All rate calculations and billing codes are already in the existing system. Your task is UI display only.

2. **Reference Existing Data**: Use the `/docs/` markdown files as your single source of truth for specifications. These files define all behavior and requirements.

3. **Design Consistency**: This panel must match Res Hab Daily's design. Study `/docs/res-hab-daily-design.md` carefully to ensure visual consistency.

4. **Rate Calculations**: Do NOT implement calculation logic. The system already calculates rates. Your UI simply displays them and allows adjustments that the system will use.

5. **Cap Enforcement**: Do NOT implement cap enforcement. The system already prevents overbilling. Your UI displays current usage for information purposes.

6. **Data Sources**: Get all configuration data from:
   - Existing billing code system
   - Existing rate calculation engine
   - Existing unit usage tracking
   - Existing rate adjustment system

7. **Testing Strategy**: Test against actual system data. Verify the UI displays system calculations correctly, not that your code calculates correctly.

8. **Persistence**: Use existing system persistence mechanisms (not localStorage). Configuration changes should save to the same backend the system uses.

This is a 2-week UI/display layer implementation project with well-defined specifications in the `/docs/` directory.
