# Spend Management & Card Controls Implementation Plan

**Status:** Planning  
**Last Updated:** June 12, 2026  
**Priority:** High (strategic product expansion)  
**Estimated Effort:** 14–19 weeks (3–4 months, 1–2 engineers)

---

## 1. Context & Strategic Value

### Problem Statement
HCBS provider agencies manage multiple homes/programs, each with separate budgets and staff spending needs. Current tools:
- Model budgets in Intrinsic (quarterly exercise)
- Have no real-time visibility into actual spend
- Cannot enforce budget limits at point-of-spend
- Spend receipts live in email/spreadsheets (audit nightmare)
- QB reconciliation is manual and error-prone

### Solution: Spend Management Layer
Add real-time spend controls, approval workflows, and receipt management on top of Intrinsic's budget modeling. This closes the modeling↔operations loop: model the budget in Intrinsic, enforce it in real spend, track actual vs. forecast.

### Strategic Benefits
1. **Stickiness** — Users live in the tool daily (not quarterly), creating transaction volume and network effects
2. **Defensible moat** — HCBS-specific workflows (not generic expense tools like Expensify)
3. **Forecast accuracy** — Know what was *actually* spent vs. budgeted, improve planning
4. **Audit readiness** — Receipts + approvals + coding = compliance trail
5. **QB integration** — Close books without manual reconciliation
6. **Upsell path** — Licensees who model also need to control spend; bundle these capabilities

### Market Size & Revenue Model
- **TAM:** ~5,000 licensed HCBS agencies in US
- **Revenue:** Likely add $20–50/user/month to existing modeling subscription (more attractive than per-transaction fees)
- **Margin:** High (no payment processing liability)

---

## 2. Scope: MVP Features

### In Scope (MVP)
- ✅ Virtual card provisioning (Divvy API)
- ✅ Budget controls by entity/program
- ✅ Spending limits and approval workflows
- ✅ Real-time transaction visibility (daily polls)
- ✅ Receipt upload + OCR (AWS Textract)
- ✅ Transaction coding (GL accounts)
- ✅ QB GL sync (post-approval spend as journal entries)
- ✅ Multi-entity reporting/dashboards
- ✅ Audit trail (who approved, when, reason)

### Out of Scope (v2+)
- ❌ Physical cards (virtual only for MVP)
- ❌ Expense reimbursement workflows (personal card receipts)
- ❌ Real-time card authorization (hard limits enforced at processor, not pre-checks)
- ❌ Mobile app (web-first)
- ❌ Integration with other card providers (Divvy only for MVP)
- ❌ International cards/multi-currency
- ❌ Recurring budget templates
- ❌ AI-powered spend categorization (manual coding only)

---

## 3. Architecture Overview

### System Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                         Intrinsic Frontend (React)              │
│  ┌─────────────────┬──────────────────┬─────────────────────┐  │
│  │ Budget Controls │ Transaction Feed │ Approval Queue      │  │
│  │ Dashboard       │ & Real-time Burn │ & Receipt Mgmt      │  │
│  │                 │                  │                     │  │
│  └────────┬────────┴──────────┬───────┴────────┬────────────┘  │
└───────────┼─────────────────────┼──────────────┼────────────────┘
            │                     │              │
            v                     v              v
┌──────────────────────────────────────────────────────────────────┐
│               Intrinsic Backend (Node/Express)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Card & Spend Management Service                         │   │
│  │  • Card provisioning API                                │   │
│  │  • Budget enforcement logic                             │   │
│  │  • Approval routing & audit trail                       │   │
│  │  • Receipt storage & OCR coordination                   │   │
│  │  • GL coding & QB sync                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ v2 Config (Supabase JSONB)                              │   │
│  │  • Card assignments, limits, approval routing           │   │
│  │  • GL coding rules, QB sync status                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Scheduled Jobs (AWS Lambda)                             │   │
│  │  • Divvy transaction sync (5-min polls)                 │   │
│  │  • Budget burn updates (real-time)                      │   │
│  │  • Approval timeout/escalation (daily)                  │   │
│  │  • QB sync (nightly, on close trigger)                  │   │
│  │  • Orphaned card detection (weekly audit)               │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
            │                     │              │
            v                     v              v
┌─────────────┐         ┌──────────────┐   ┌────────────────┐
│  Divvy API  │         │ AWS Textract │   │ QB Online API  │
│             │         │ (OCR)        │   │ (GL sync)      │
│ • Issue     │         │              │   │                │
│   card      │         └──────────────┘   └────────────────┘
│ • Poll      │
│   transactions
│ • Set limits
│ • Revoke card
└─────────────┘
```

### Data Flow: Card Provisioning

```
CFO Admin Panel
  ↓
"Provision card for Sarah, Home #1, $15k/mo, threshold $500"
  ↓
Intrinsic Backend validates:
  • User has permission to manage Home #1
  • Sarah exists in org
  • Budget $15k exists
  ↓
Calls Divvy API:
  POST /v1/cards
  {
    holder_name: "Sarah",
    holder_email: "sarah@homeboise.com",
    limits: {single_transaction: 1000, daily: 3000, monthly: 15000},
    metadata: {intrinsic_entity_id: "home_1"}
  }
  ↓
Divvy responds:
  {card_id: "card_xyz789", card_number: "4111...1111"}
  ↓
Intrinsic stores in v2 config:
  companies[0].spend.cards[] = {
    id: "card_xyz789",
    assignedTo: {name: "Sarah", email: "sarah@..."},
    linkedEntity: "home_1",
    limits: {...},
    status: "active"
  }
  ↓
Divvy emails Sarah the card number
  ↓
Sarah can spend immediately
```

### Data Flow: Transaction Approval

```
Sarah spends $200 at Safeway (Monday 10:30am)
  ↓
Divvy processes, marks "pending"
  ↓
Lambda job polls Divvy API (runs every 5 mins)
  ↓
Finds $200 Safeway transaction (pending)
  ↓
Intrinsic backend:
  1. Matches to Home #1 (via card_id → entity mapping)
  2. Checks Home #1 budget: $200 < $15k threshold, spend allowed
  3. Checks approval threshold: $200 < $500, auto-approve (no routing needed)
  4. Creates transaction record:
     {
       id: "txn_123",
       cardId: "card_xyz789",
       amount: 200,
       merchant: "Safeway",
       linkedEntity: "home_1",
       status: "posted",
       approvalStatus: "auto_approved",
       receiptStatus: "pending_upload",
       codingStatus: "uncoded"
     }
  5. Updates budget burn:
     Home #1: spent $200, remaining $14,800
  ↓
Frontend shows in Transaction Feed:
  "Safeway $200 (Home #1) — Receipt pending, Coding pending"
  ↓
Tuesday 9am: Sarah uploads receipt photo in Intrinsic
  ↓
AWS Textract extracts: amount=$200, merchant=Safeway, date=6/10
  ↓
Frontend shows receipt, Sarah can code it
  ↓
Sarah codes: "Groceries" → GL 6100
  ↓
Receipt + coding captured
  ↓
Month-end: Intrinsic syncs approved transactions to QB:
  POST /v1/journals
  {
    account: "6100",
    amount: 200,
    description: "Safeway - Home #1 groceries",
    date: "2026-06-10",
    reference: "txn_123"
  }
  ↓
QB creates journal entry
  ↓
QB syncs back to Intrinsic for reconciliation
```

### Data Flow: Large Purchase (Approval Required)

```
Tom tries to buy mattresses ($1,500) Friday 2pm
  ↓
Tom's card is declined by Divvy (exceeds $1,000 single-txn limit)
  ↓
Tom logs into Intrinsic
  ↓
Clicks "Request one-time increase" for $1,500 purchase
  ↓
Intrinsic creates approval request:
  {
    id: "req_456",
    type: "limit_increase",
    linkedCard: "card_tom",
    linkedEntity: "home_2",
    requestedAmount: 1500,
    reason: "Mattress purchase",
    requestedBy: "Tom",
    routeTo: ["program_director", "cfo"],
    status: "pending"
  }
  ↓
Program Director & CFO get notified (email + in-app)
  ↓
Program Director opens approval queue in Intrinsic
  ↓
Reviews: Home #2 has $13,200 available budget, $1,500 is reasonable
  ↓
Clicks "Approve"
  ↓
Intrinsic:
  1. Calls Divvy API: "Increase Tom's single-txn limit to $2,000 for 2 hours"
  2. Records approval: {approvedBy: "PD", approvedAt: timestamp, approvalId: "appr_789"}
  3. Sends Tom notification: "Your $1,500 request approved, try your card again"
  ↓
Tom retries purchase with card
  ↓
Succeeds (Divvy accepts now)
  ↓
Lambda captures transaction: $1,500 mattress
  ↓
Intrinsic flags as pre-approved (approval_id: "appr_789")
  ↓
No further approval needed, just receipt collection needed
```

---

## 4. Data Model: v2 Config Blob Changes

### Current v2 Blob Structure (FinancialTool.jsx)
```js
{
  version: 2,
  selectedCompanyId: string,
  selectedServiceLineId: string | null,
  companies: [
    {
      id: string,                    // co_xxxxxxxx
      name: string,
      archived: boolean,
      shared: { wage, graveyardWage, ... },
      serviceLines: [{ id, type, name, ... }]
    }
  ]
}
```

### New `spend` Object in Company
```js
companies[0] = {
  id: "co_xxxxxxxx",
  name: "Boise Home Care",
  shared: { ... },
  serviceLines: [ ... ],
  
  // NEW: Spend management
  spend: {
    // ===== Card Processor Integration =====
    processor: "divvy",                    // "divvy" | "stripe" | "brex"
    processorAccountId: "org_xxxxx",       // API identifier at Divvy
    processorApiKey: "sk_live_xxxxx",      // Encrypted in Supabase (RLS)
    
    // ===== Card Registry =====
    cards: [
      {
        id: "card_xyz789",                 // Divvy card ID
        status: "active" | "revoked" | "archived",
        createdAt: timestamp,
        revokedAt: timestamp | null,
        
        // ===== Card Assignment =====
        assignedTo: {
          name: "Sarah",
          email: "sarah@homeboise.com",
          role: "home_manager" | "program_director" | "cfo",
          internalUserId: "user_abc123"   // Intrinsic user ID (optional)
        },
        
        // ===== Entity Link =====
        linkedEntity: {
          type: "home" | "program" | "department",
          id: "home_1"                    // matches serviceLineId or custom
        },
        
        // ===== Spending Limits (hard limits, enforced by Divvy) =====
        limits: {
          singleTransaction: 1000,         // dollars
          daily: 3000,
          monthly: 15000
        },
        
        // ===== Metadata =====
        isPhysical: false,                 // true = physical card shipped
        physicalShippedAt: timestamp | null,
        lastUsedAt: timestamp | null,
        transactionCount: integer
      }
    ],
    
    // ===== Budget Rules (soft limits, enforced by Intrinsic) =====
    budgets: [
      {
        id: "budget_home1",
        linkedEntity: {
          type: "home" | "program",
          id: "home_1"
        },
        period: "monthly",
        amount: 15000,                     // dollars/month
        approvalThreshold: 500,            // >$500 requires approval
        
        // ===== Approval Routing =====
        approvalRouting: {
          threshold0_500: "auto",          // auto-approve < $500
          threshold500_5000: ["program_director"],
          threshold5000_plus: ["cfo", "program_director"]
        },
        
        // ===== Budget Tracking =====
        currentPeriodStart: timestamp,
        currentPeriodEnd: timestamp,
        spent: 5200,                       // YTD or period-to-date
        pending: 300,                      // authorized but not posted
        remaining: 9500,
        
        // ===== Escalation Rules =====
        escalationRules: {
          atCapacity: 0.85,               // alert @ 85% spent
          requiresApprovalAbove: 500,     // >$500 needs approval
          autoRollover: true              // monthly reset
        }
      }
    ],
    
    // ===== GL Coding Rules =====
    codings: [
      {
        id: "code_groceries",
        patterns: {
          merchantNames: ["safeway", "albertsons", "whole foods"],
          mcc: ["5411"],                  // MCC 5411 = grocery store
          keywords: ["groceries", "food", "produce"]
        },
        glAccount: "6100",                 // Food & Beverage
        costCenter: "home_1",              // optional
        autoCode: true,                    // auto-apply this rule
        createdBy: "cfo",
        createdAt: timestamp
      },
      {
        id: "code_utilities",
        patterns: {
          merchantNames: ["idaho power", "qwest", "water"],
          mcc: ["4812"]                   // utilities
        },
        glAccount: "6200",
        autoCode: true
      }
    ],
    
    // ===== Transaction Log =====
    transactions: [
      {
        id: "txn_001",
        divvyId: "txn_12345_divvy",        // Divvy's transaction ID
        cardId: "card_xyz789",
        linkedEntity: "home_1",
        
        // ===== Transaction Details =====
        amount: 200,
        currency: "USD",
        merchant: "Safeway",
        merchantCategory: "grocery",
        transactionDate: timestamp,
        settledDate: timestamp | null,
        
        // ===== Status =====
        divvyStatus: "posted" | "pending" | "reversed",
        receiptStatus: "none" | "pending_upload" | "uploaded" | "verified",
        codingStatus: "uncoded" | "auto_coded" | "manually_coded",
        approvalStatus: "auto_approved" | "pending" | "approved" | "rejected",
        
        // ===== Receipt & Documentation =====
        receipt: {
          uploadedAt: timestamp | null,
          uploadedBy: string,
          s3Url: "s3://intrinsic-receipts/txn_001/receipt.jpg",
          ocrData: {
            extractedAmount: 200,
            extractedDate: "2026-06-10",
            extractedMerchant: "Safeway #1234",
            confidence: 0.95
          }
        },
        
        // ===== Coding & GL =====
        coding: {
          glAccount: "6100",
          costCenter: "home_1",
          codedBy: "sarah",
          codedAt: timestamp,
          autoCodeRuleId: "code_groceries" | null
        },
        
        // ===== Approval Audit Trail =====
        approval: {
          requiredApproval: true,
          approvedBy: "program_director",
          approvedAt: timestamp,
          approvalReason: "routine",
          escalatedAt: timestamp | null,
          escalatedReason: null
        },
        
        // ===== QB Sync =====
        qbSync: {
          synced: true,
          syncedAt: timestamp,
          qbJournalId: "23456",
          qbLineId: "1"
        }
      }
    ],
    
    // ===== Approval Queue (transient, in-memory or Redis?) =====
    pendingApprovals: [
      {
        id: "appr_req_789",
        type: "transaction" | "limit_increase" | "override",
        relatedTransaction: "txn_001" | null,
        relatedLimitIncrease: null,
        requestedBy: "sarah",
        requestedAt: timestamp,
        routedTo: ["program_director"],
        status: "pending" | "approved" | "rejected",
        deadline: timestamp,
        escalated: false
      }
    ],
    
    // ===== QB Integration =====
    quickbooksSync: {
      enabled: true,
      realm_id: "123456789",               // QB account ID
      access_token: "...",                 // Encrypted
      refresh_token: "...",                // Encrypted
      lastSyncAt: timestamp,
      lastSyncStatus: "success" | "failed",
      lastSyncError: null,
      
      // ===== GL Account Mappings =====
      glAccountMappings: {
        "6100": "6100",                    // Intrinsic GL → QB GL
        "6200": "6200"
      },
      
      // ===== Sync Settings =====
      autoSyncOnApproval: false,           // manual sync on close
      syncFrequency: "daily" | "on_close"
    }
  }
}
```

### Rationale for Structure
- **Processor abstraction:** `processor: "divvy"` makes it easy to add Stripe/Brex later without schema change
- **Cards registry:** Single source of truth for all issued cards and their status
- **Budgets separate from serviceLines:** Spending budgets are horizontal (per-home, per-person) and distinct from service line profitability models
- **Codings as rules:** Merchants → GL accounts are stored as patterns, enabling auto-coding and auditability
- **Transaction log:** Every transaction is captured with full audit trail (approval, receipt, coding, QB sync)
- **Approval queue:** Transient state, but could be persisted for audit/retry logic
- **QB integration:** Parallel to the Intrinsic model; QB sync is its own concern with encryption for tokens

---

## 5. Implementation Phases

### Phase 1: Foundation (Weeks 1–3, ~3 weeks)

**Goal:** Card provisioning and transaction polling working end-to-end.

#### 1.1 Backend: Divvy API Integration
- [ ] Create `src/services/spend/divvyService.js`
  - `provisionCard(holder, limits, entityId)` → calls Divvy, returns card object
  - `listTransactions(accountId, since)` → polls Divvy, returns transactions
  - `getCard(cardId)` → fetch card details
  - `revokeCard(cardId)` → disable card at Divvy
  - `setCardLimits(cardId, limits)` → update limits
  - Error handling, retry logic, rate limiting
- [ ] Create `src/services/spend/spendService.js`
  - `addCard(company, holder, limits, entityId)` → wrapper, updates v2 config
  - `syncTransactions(company)` → fetch from Divvy, insert into config.spend.transactions[]
  - Input validation, auth checks

#### 1.2 Frontend: Card Provisioning UI
- [ ] Create `src/pages/SpendDashboard.jsx` (new top-level page)
  - Tabs: "Cards", "Transactions", "Budgets", "Approvals"
- [ ] "Cards" tab: card list + provision card button
  - Form: name, email, entity, limits (single-txn, daily, monthly)
  - Validation: name/email required, limits reasonable (limits.single < limits.daily < limits.monthly)
  - Submit → calls backend → displays card number to CFO (one-time, for sharing with employee)
- [ ] Display card status: active/revoked, last used, transaction count
- [ ] Button to revoke card (with confirmation)

#### 1.3 Frontend: Transaction Feed
- [ ] "Transactions" tab: list of all transactions
  - Columns: Date, Merchant, Amount, Entity, Status (Posted/Pending), Receipt, Coding
  - Filter by entity, date range, status
  - Real-time updates (poll backend every 5 mins, or use WebSocket if available)
  - Each transaction row is clickable → detail view

#### 1.4 Database/Config Changes
- [ ] Update `migrateConfig()` in `companyShape.js` to handle v2.1 with new `spend` object
  - If `spend` is missing, initialize as empty shell
  - Preserve existing data

#### 1.5 Scheduled Job: Divvy Sync
- [ ] Create `src/jobs/divvySyncJob.js`
  - Runs every 5 minutes (AWS Lambda, or node-schedule if self-hosted)
  - For each company with Divvy enabled:
    - Call `syncTransactions()`
    - Upsert transactions into v2 config
    - Update budget burn
    - Check for budget overages, send alerts
  - Error handling, logging, retry on failure

#### 1.6 Testing
- [ ] Unit tests for `divvyService.js` (mock Divvy API)
- [ ] Integration test: provision card → poll transaction → appears in config
- [ ] Manual test: connect to Divvy sandbox, provision test card, make test transaction, verify sync

**Deliverable:** Divvy cards can be provisioned and transactions are synced in real-time. Budget burn is tracked but no approvals yet.

---

### Phase 2: Budget Controls & Approvals (Weeks 4–7, ~4 weeks)

**Goal:** Budget enforcement, approval workflows, audit trail.

#### 2.1 Backend: Budget Enforcement
- [ ] Create `src/services/spend/budgetService.js`
  - `validateSpend(amount, entityId, budgetId)` → check against limits, return {allowed: bool, reason: string}
  - `checkApprovalNeeded(amount, threshold)` → true if >threshold
  - `calculateBudgetBurn(company, entityId, period)` → {spent, pending, remaining, percentUsed}
  - `canCoverSpend(entityId, amount)` → check remaining budget

#### 2.2 Backend: Approval Routing
- [ ] Create `src/services/spend/approvalService.js`
  - `routeApprovalRequest(type, linkedTransaction, linkedEntity, requestedAmount, requestedBy)` → determines who approves
  - `getUserApprovalsQueue(user)` → get pending approvals for this user
  - `approveRequest(approvalId, approverId)` → mark approved, trigger action (Divvy limit increase, etc.)
  - `rejectRequest(approvalId, approverId, reason)` → mark rejected, notify requester

#### 2.3 Backend: Audit Trail
- [ ] Update transaction schema: add `approval` object (approvalStatus, approvedBy, approvedAt, reason)
- [ ] Update transaction schema: add `approval.auditTrail[]` = [{actor, action, timestamp, comment}]
- [ ] Log all state changes (transaction posted, receipt uploaded, coded, approved, rejected, synced to QB)

#### 2.4 Frontend: Approval Queue
- [ ] Create `src/components/ApprovalQueueTab.jsx`
  - List of pending approvals
  - For each: type, requester, entity, amount, date, status
  - Clickable row → detail view
  - Approve/reject buttons
  - Audit trail (who approved before, when, reason)

#### 2.5 Frontend: Budget Status
- [ ] Update "Budgets" tab
  - List entities and their budgets
  - Bar chart: spent vs. remaining
  - Show pending transactions (not yet posted)
  - Color: green (<50%), yellow (50-85%), red (>85%)
  - Click entity → drill down to transaction list for that entity

#### 2.6 Frontend: Transaction Detail View
- [ ] Modal/drawer showing full transaction
  - Merchant, amount, date, status
  - If approval required: approval state + audit trail
  - Budget context: entity's available budget, whether this transaction requires approval

#### 2.7 Testing
- [ ] Unit tests for `budgetService.js` and `approvalService.js`
- [ ] Integration test: spend >threshold → approval request created → approver approves → status updated
- [ ] Manual test: test approval routing (team member spend, manager approval, CFO approval)

**Deliverable:** Approval workflows work end-to-end. Budget limits are enforced. Audit trail is complete.

---

### Phase 3: Receipt Management & GL Coding (Weeks 8–11, ~4 weeks)

**Goal:** Receipt uploads, OCR, GL coding, QB integration foundation.

#### 3.1 Backend: Receipt Storage
- [ ] Create `src/services/spend/receiptService.js`
  - `uploadReceipt(txnId, file)` → upload to S3, return signed URL
  - `getReceipt(txnId)` → return S3 URL + metadata
  - `deleteReceipt(txnId)` → remove from S3
  - S3 bucket: `intrinsic-receipts-{env}`, path: `{companyId}/{txnId}/{filename}`
  - Permissions: only authenticated users with company access can upload

#### 3.2 Backend: OCR Integration (AWS Textract)
- [ ] Create `src/services/spend/ocrService.js`
  - `extractReceiptData(s3Url)` → calls AWS Textract, returns {amount, date, merchant, items, confidence}
  - Async job: receipt uploaded → queue OCR → store results in transaction.receipt.ocrData
  - Error handling, fallback to manual extraction

#### 3.3 Backend: GL Coding Service
- [ ] Create `src/services/spend/codingService.js`
  - `autoCodeTransaction(txn)` → match merchant/MCC to coding rules, return suggested GL account
  - `codeTransaction(txnId, glAccount, costCenter)` → update transaction.coding
  - `createCodingRule(pattern, glAccount)` → add new merchant→GL mapping
  - Merchant name pattern matching, MCC-based matching

#### 3.4 Frontend: Receipt Upload UI
- [ ] Transaction detail view: "Upload Receipt" button
  - Drag-and-drop or file picker
  - Shows progress bar
  - After upload: "Extracting data..." → shows extracted amount/date/merchant
  - User can confirm or manually edit if OCR was wrong

#### 3.5 Frontend: GL Coding UI
- [ ] Transaction detail view: "Code Transaction" section
  - Show auto-suggested GL account (if available)
  - Dropdown to pick different account
  - Optional: cost center picker
  - Shows GL account list (fetched from QB or hardcoded chart of accounts)
  - Save → updates transaction.coding

#### 3.6 Backend: QB Integration Foundation
- [ ] Create `src/services/spend/qbService.js`
  - `connectToQB(company, realmId, accessToken, refreshToken)` → store QB credentials (encrypted)
  - `getGLAccounts(company)` → fetch chart of accounts from QB
  - `syncTransaction(txn)` → post journal entry to QB
  - Error handling, retry logic

#### 3.7 Testing
- [ ] Unit tests for `receiptService.js`, `ocrService.js`, `codingService.js`
- [ ] Integration test: upload receipt → OCR extracts data → user codes → data stored
- [ ] Manual test: upload real receipt, verify OCR extraction accuracy
- [ ] QB sandbox test: create journal entry via API

**Deliverable:** Receipts can be uploaded and OCR'd. Transactions can be coded to GL accounts. QB integration skeleton is ready.

---

### Phase 4: QB Sync & Dashboards (Weeks 12–15, ~4 weeks)

**Goal:** Sync approved spend to QB. Build real-time dashboards. End-to-end testing.

#### 4.1 Backend: QB Sync Job
- [ ] Create `src/jobs/qbSyncJob.js`
  - Runs nightly or on-demand (CFO clicks "Sync to QB")
  - For each company with QB enabled:
    - Find all transactions with status "approved" and codingStatus "coded" and qbSync.synced = false
    - For each: create journal entry in QB (date, GL account, cost center, amount, description, reference)
    - Update transaction.qbSync = {synced: true, syncedAt, qbJournalId, qbLineId}
    - Send confirmation email to CFO
  - Error handling, logging, retry on QB API errors

#### 4.2 Backend: QB Reconciliation
- [ ] Create `src/services/spend/reconciliationService.js`
  - `getQBJournals(company, since)` → fetch recent journals from QB
  - `matchJournalToTransaction(qbJournal)` → match to Intrinsic transaction (by reference ID)
  - `getReconciliationStatus(company)` → {synced, unsynced, mismatched, totalAmount}

#### 4.3 Frontend: QB Sync Dashboard
- [ ] "QB Sync" tab
  - Status: "Connected to QB" or "Not connected"
  - If connected: show recent syncs (date, # transactions, total amount, status)
  - Button: "Sync Now" (manual trigger)
  - Reconciliation status: "100 transactions synced, $25,000 total"
  - Link to QB online to verify

#### 4.4 Frontend: Real-Time Dashboards
- [ ] Update dashboard/main view
  - Top card: "Total spend this month: $25,450 / $60,000 budget (42%)"
  - By entity: $15,200 / $15,000 (Home #1, red), $10,250 / $15,000 (Home #2, yellow), etc.
  - Approval queue widget: "5 pending approvals"
  - Receipt status widget: "23 receipts uploaded, 2 missing"
  - QB sync status: "Last synced 6/12 at 2pm, 47 transactions"

#### 4.5 Frontend: Reporting
- [ ] "Reports" tab
  - Budget summary: entity, period, budget, spent, remaining, % used
  - Spend by category: pie chart (groceries 40%, utilities 20%, etc.)
  - Spend by entity: bar chart (Home #1, #2, #3, #4)
  - Approval stats: # approved, # rejected, avg approval time
  - Receipt compliance: % with receipts by entity
  - QB reconciliation: synced vs. unsynced, mismatches

#### 4.6 Backend: Notifications
- [ ] Create `src/services/spend/notificationService.js`
  - Send email/Slack when:
    - Transaction needs approval (to approver)
    - Approval request is resolved (to requester)
    - Receipt is missing (to card holder)
    - Budget is at 85% capacity (to manager)
    - QB sync failed (to CFO)
  - User notification preferences (email only, in-app only, both)

#### 4.7 Testing
- [ ] Integration test: approve transaction → sync to QB → verify journal created
- [ ] Manual test: full flow end-to-end (provision card → spend → upload receipt → code → approve → sync to QB)
- [ ] Performance test: dashboard load time with 10k transactions
- [ ] Stress test: 100 simultaneous approvals

**Deliverable:** QB sync works. Dashboards are complete. Full end-to-end flow is tested.

---

### Phase 5: Hardening & Launch (Weeks 16–19, ~4 weeks)

**Goal:** Security, performance, edge cases, production readiness.

#### 5.1 Security & Compliance
- [ ] Review Divvy API token storage (encrypted at rest, access controlled by RLS)
- [ ] Review QB token storage (encrypted at rest, access controlled by RLS)
- [ ] Receipt S3 bucket: private by default, signed URLs for access
- [ ] Audit logging: log all sensitive actions (card provisioning, approval, QB sync, credential access)
- [ ] PCI compliance: ensure no card numbers are stored or logged in Intrinsic (Divvy handles this)
- [ ] Security review: code review for injection attacks, auth bypass, data leaks

#### 5.2 Error Handling & Edge Cases
- [ ] Card provisioning fails: rollback transaction, show user-friendly error
- [ ] Divvy API down: queue sync requests, retry with exponential backoff
- [ ] Receipt OCR fails: allow manual entry of amount/date
- [ ] QB sync fails: show error detail, allow retry, don't lose transaction
- [ ] Budget calculation drift: reconcile budget burn periodically (daily job)
- [ ] Duplicate transactions: deduplicate by Divvy txn ID
- [ ] Transaction refund/reversal: handle in Divvy sync, deduct from budget burn

#### 5.3 Performance Optimization
- [ ] Dashboard with 1M+ transactions: pagination, lazy load, indexing on company/entity/date
- [ ] Transaction polling (5-min intervals): limit to recent txns, use Divvy pagination
- [ ] OCR async job: don't block transaction display, process in background
- [ ] QB sync: batch journal posts, handle API rate limits
- [ ] Approval queue: index by approver + status, fast filters

#### 5.4 Monitoring & Alerting
- [ ] CloudWatch logs: Divvy API calls, OCR jobs, QB sync, approval routing
- [ ] Metrics: # cards issued, # transactions/day, # approvals, # QB syncs, error rate
- [ ] Alerts: Divvy sync failure, QB sync failure, approval timeout (>24h), budget overage, receipt compliance <80%
- [ ] Dashboard: ops team can see spend system health

#### 5.5 Documentation
- [ ] Admin guide: how to provision cards, set budgets, configure approvals
- [ ] User guide: how to upload receipts, code transactions, track spend
- [ ] API docs: backend spend endpoints
- [ ] Troubleshooting: common issues (card declined, receipt OCR wrong, QB sync failed)

#### 5.6 Migration & Rollout
- [ ] Feature flag: "spend.enabled" in company config (can be enabled per company)
- [ ] Beta: roll out to 1–2 customers for testing
- [ ] Gather feedback: what's missing, what's broken, UX issues
- [ ] Iterate: fix bugs, improve UX
- [ ] GA: release to all customers

#### 5.7 Testing
- [ ] End-to-end testing with real Divvy sandbox account
- [ ] Performance testing: 10k transactions in dashboard
- [ ] Failure scenarios: Divvy API down, QB sync fails, receipt upload fails
- [ ] Security testing: verify auth/RLS, no data leaks
- [ ] Browser compatibility: Chrome, Safari, Firefox

**Deliverable:** Production-ready. All edge cases handled. Monitoring in place. Documentation complete.

---

## 6. Critical Implementation Details

### Divvy API Integration

**Endpoints used:**
```
POST /v1/cards                          — Create virtual card
GET /v1/cards/{cardId}                  — Get card details
POST /v1/cards/{cardId}                 — Update card (limits, status)
DELETE /v1/cards/{cardId}               — Revoke card
GET /v1/transactions                    — List transactions (paginated)
GET /v1/transactions/{txnId}            — Get transaction details
```

**Authentication:** Bearer token (API key stored encrypted in Supabase)

**Rate limits:** 100 req/min per account (batching recommended)

**Sandbox:** Divvy provides sandbox environment for testing (fake card numbers, test merchants)

**Card issuance latency:**
- Virtual card: issued in <1 minute, card number returned immediately
- Physical card: 5–7 business days (deferred to v2)

**Transaction polling:**
- Divvy reports transactions 4–6 hours after they're authorized
- Pending → Posted is typically 24–48 hours (depends on merchant)

### AWS Textract for Receipt OCR

**Workflow:**
1. User uploads receipt image (JPG/PNG)
2. Intrinsic stores in S3
3. Lambda triggered, calls AWS Textract
4. Textract returns extracted form data (amount, date, merchant, items)
5. Results stored in transaction.receipt.ocrData
6. Frontend displays extracted data, user can confirm/edit

**Accuracy:** ~90–95% for clear receipts, lower for poor lighting/angle

**Cost:** $0.015 per page (cheap)

**Fallback:** If OCR confidence <0.7 or fails, show manual entry form

### QB Online API Integration

**OAuth flow:**
1. CFO clicks "Connect to QB"
2. Redirected to QB login + permission dialog
3. QB returns authorization code
4. Intrinsic exchanges code for access token + refresh token
5. Tokens stored encrypted in v2 config

**Endpoints:**
```
POST /v2/accounts/{realmId}/journals      — Create journal entry
GET /v2/accounts/{realmId}/accounts       — List chart of accounts
GET /v2/accounts/{realmId}/journals       — Query journals
```

**Journal entry format:**
```json
{
  "Line": [
    {
      "DetailType": "JournalEntryLineDetail",
      "Amount": 200,
      "Description": "Safeway - Home #1 groceries",
      "JournalEntryLineDetail": {
        "AccountRef": {
          "value": "6100"
        }
      }
    }
  ],
  "TxnDate": "2026-06-10",
  "DocNumber": "txn_001",
  "Memo": "Spend management sync"
}
```

**Reconciliation:** Batch sync nightly (or on-demand), post all approved+coded transactions as single journal entry per day

### RLS Policies (Supabase)

Transactions and approvals are stored in the JSONB v2 config blob, so no separate table-level RLS needed. However, ensure:
- Only company members can read/write their company's spend data
- Only approvers can access approval queue for their company
- Only CFO can change Divvy/QB credentials
- Audit log is immutable (append-only)

### State Machine: Transaction Lifecycle

```
┌─────────────┐
│  Created    │  (Divvy issued card, user made purchase)
│ (pending)   │
└──────┬──────┘
       │
       v
┌─────────────────┐
│ Posted          │  (Divvy confirmed, fund moved)
│ (posted)        │
└──────┬──────────┘
       │
       v
┌──────────────────────────┐
│ Receipt & Coding         │  (User uploads receipt + OCR, codes to GL)
│ (awaiting_approval)      │
└──────┬───────────────────┘
       │
       v
┌──────────────────────┐
│ Approved             │  (Manager/CFO approved)
│ (approved)           │
└──────┬───────────────┘
       │
       v
┌──────────────────────┐
│ Synced to QB         │  (Journal entry posted to QB)
│ (synced_to_qb)       │
└──────────────────────┘

Error paths:
- Receipt upload fails → remain in "awaiting_approval", retry later
- Approval rejected → marked "rejected", can be resubmitted
- QB sync fails → retry nightly job
```

---

## 7. File Structure

```
src/
  pages/
    SpendDashboard.jsx              ← Main spend management UI
  components/
    spend/
      CardProvisionForm.jsx         ← Provision card dialog
      CardList.jsx                  ← List issued cards
      TransactionFeed.jsx           ← Transaction list + filters
      TransactionDetail.jsx         ← Detail view + approval + receipt + coding
      BudgetSummary.jsx             ← Budget status by entity
      ApprovalQueueTab.jsx          ← Pending approvals list
      ReceiptUpload.jsx             ← Receipt upload widget
      GLCodingPicker.jsx            ← GL account selector
      QBSyncStatus.jsx              ← QB sync dashboard
      SpendReporting.jsx            ← Reports & charts
  services/
    spend/
      divvyService.js               ← Divvy API wrapper
      spendService.js               ← High-level spend logic
      budgetService.js              ← Budget calculations
      approvalService.js            ← Approval routing
      receiptService.js             ← S3 receipt storage
      ocrService.js                 ← AWS Textract wrapper
      codingService.js              ← GL coding logic
      qbService.js                  ← QB API wrapper
      reconciliationService.js       ← QB reconciliation
      notificationService.js        ← Email/Slack alerts
  jobs/
    divvySyncJob.js                 ← Divvy transaction polling (Lambda)
    qbSyncJob.js                    ← QB journal sync (Lambda)
  lib/
    companyShape.js                 ← Updated with v2.1 spend schema
```

---

## 8. Testing Strategy

### Unit Tests
- `divvyService.test.js` — mock Divvy API, test provisioning/polling/revocation
- `budgetService.test.js` — test budget calculations, threshold checks
- `approvalService.test.js` — test approval routing, auto-approve logic
- `codingService.test.js` — test merchant→GL matching, pattern logic
- Goal: >80% code coverage

### Integration Tests
- Provision card → sync transaction → verify in config
- Spend < threshold → auto-approve
- Spend > threshold → route to approver → approve → allow
- Upload receipt → OCR extracts → user codes → status updated
- Approve → QB sync → verify journal created

### E2E Tests (Playwright)
- Full flow: CFO provisions card → staff member spends → receipt uploaded → coded → approved → synced to QB
- Approval workflow: large purchase → decline → request increase → approve → retry
- Budget overage: spend to limit → try to exceed → blocked
- QB connection: connect to QB → sync → verify in QB online

### Manual Testing Checklist
- [ ] Divvy sandbox: provision card, make test transaction, verify sync
- [ ] Receipt upload: test JPG, PNG, PDF formats; verify OCR accuracy
- [ ] Approval queue: test different approval thresholds, routing
- [ ] Budget visualization: verify bar charts, percentages, color coding
- [ ] QB sandbox: connect account, sync transactions, verify journals
- [ ] Performance: load 10k transactions in transaction feed, verify UX
- [ ] Error handling: simulate Divvy/QB API down, verify error messages
- [ ] Mobile: test on iPhone/Android (web app)
- [ ] Browsers: Chrome, Safari, Firefox
- [ ] Permissions: test RBAC (card admin, approver, viewer, no access)

---

## 9. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Divvy API unavailable** | High | Queue sync requests, retry with exponential backoff. Alert ops if sync fails >1hr. Fallback: show last-known transactions. |
| **QB sync creates duplicate journals** | High | Deduplicate by transaction ID (DocNumber field). Idempotent API calls (set unique DocNumber per transaction). |
| **Receipt OCR fails on poor images** | Medium | Allow manual entry fallback. Log failed OCRs, improve model later. Show user: "Could not auto-extract, please enter below." |
| **Budget calculation drift** | Medium | Daily reconciliation job: fetch all Divvy txns, recalculate budget burn, flag discrepancies. Audit log all budget updates. |
| **Approval bottleneck** | Medium | Escalation rules: auto-forward to CFO if pending >24h. Audit trail shows who's blocking. Team can override (with audit entry). |
| **Card provisioning fails for staff without bank account** | Low | Divvy requires basic KYC. Provide clear error message, link to help docs. |
| **Performance: 100k+ transactions slow** | Medium | Paginate, lazy-load, index by company/entity/date. Use Redis to cache budget burn. |
| **RLS breach: staff sees others' transactions** | Critical | Verify RLS policies. Unit test: staff member queries config, only sees their data. Audit log all access. |
| **PCI compliance failure** | Critical | Never store card numbers in Intrinsic. Divvy API tokens encrypted at rest. Audit log all credential access. Annual PCI attestation. |
| **Rollout breaks existing modeling** | Medium | Feature flag: spend.enabled. Roll out to 1–2 beta customers first. Have rollback plan (feature flag off). |

---

## 10. Success Criteria

### Functional
- ✅ Cards can be provisioned for multiple staff members
- ✅ Transactions are synced in real-time (within 5 mins of Divvy API availability)
- ✅ Budgets are enforced: spend cannot exceed limit without approval
- ✅ Approval workflows route to correct approvers based on amount/threshold
- ✅ Receipts can be uploaded and OCR'd with >85% accuracy
- ✅ Transactions can be coded to GL accounts
- ✅ Approved transactions sync to QB as journal entries
- ✅ Multi-entity spend is visible in real-time dashboards

### Performance
- ✅ Dashboard loads in <2 seconds with 100k transactions
- ✅ Divvy sync completes in <30 seconds (for typical company with ~50 cards)
- ✅ QB sync completes in <1 minute (batched journal posts)
- ✅ Receipt upload + OCR completes in <10 seconds

### Reliability
- ✅ 99.9% uptime (SLA for sync jobs)
- ✅ Divvy API outages don't break Intrinsic (graceful degradation)
- ✅ QB API outages are retried nightly (no data loss)
- ✅ All state transitions are logged (audit trail complete)

### UX
- ✅ CFO can provision a card in <2 minutes (including form validation)
- ✅ Approver can approve/reject a request in <30 seconds
- ✅ Staff member can upload receipt + code in <2 minutes (OCR helps)
- ✅ Dashboard is intuitive: budget burn visible at a glance

### Security
- ✅ No card numbers stored in Intrinsic database
- ✅ API tokens encrypted at rest
- ✅ RLS policies prevent cross-company data leaks
- ✅ All sensitive actions logged in audit trail
- ✅ PCI DSS compliance verified (no card data handling)

### Adoption
- ✅ Beta customers use spend controls within first week
- ✅ >50% of beta transactions have receipts uploaded
- ✅ >80% of approvals are resolved within 24 hours
- ✅ QB sync is used by >70% of beta customers (indicates value)

---

## 11. Dependencies & Prerequisites

### External Services
- **Divvy Account:** Sandbox for dev/testing, live account for production
  - Contact: developer@divvy.com, set up API keys
- **AWS Services:** S3 (receipts), Textract (OCR), Lambda (scheduled jobs)
- **QB Online Account:** Sandbox and live realms for testing
  - Register app with QB at developer.intuit.com
- **Email/Slack:** For notifications (SendGrid or SES)

### Internal Dependencies
- ✅ v2 config blob (FinancialTool.jsx) — already implemented
- ✅ Supabase auth/RLS — already in place
- ✅ QuickBooks integration foundation (for QB API wrapper) — may exist from prior work
- ⚠️ AWS Lambda / scheduled job infrastructure — may need setup if not already present

### Skills & Team
- 1–2 full-stack engineers (or 1 backend + 1 frontend)
- 1 QA engineer (testing, edge cases)
- Product owner (stakeholder feedback, prioritization)
- Security/compliance review (PCI, data handling)

---

## 12. Timeline & Effort

| Phase | Duration | Key Deliverable | Team Size |
|-------|----------|-----------------|-----------|
| **Phase 1: Foundation** | 3 weeks | Cards provisioned, transactions synced, budget burn tracked | 1–2 FTE |
| **Phase 2: Approvals** | 4 weeks | Approval workflows, audit trail, budget enforcement | 1–2 FTE |
| **Phase 3: Receipts & Coding** | 4 weeks | Receipt upload, OCR, GL coding, QB foundation | 1–2 FTE |
| **Phase 4: QB Sync & Dashboards** | 4 weeks | QB integration complete, dashboards ready, end-to-end tested | 1–2 FTE |
| **Phase 5: Hardening & Launch** | 4 weeks | Security audit, performance tuning, docs, beta rollout | 1–2 FTE |
| **TOTAL** | **19 weeks (4.75 months)** | Production-ready spend management | 1–2 FTE |

**Parallelization notes:**
- Phases 1 & 2 can overlap (backend in P2 while frontend is done in P1)
- Phase 3 can start once Phase 2 is stable (receipt upload is independent of approvals)
- Phase 4 depends on Phase 3 (QB sync needs coded transactions)
- Phase 5 happens throughout (security/perf considerations from day 1)

**Realistic timeline:** 4–5 months with 1 engineer, 3 months with 2 engineers (overlap)

---

## 13. Go-to-Market

### Beta Program (2–4 customers)
- Select 2–4 customers who are:
  - Tech-savvy (can give detailed feedback)
  - Have multiple homes/programs (benefit from multi-entity controls)
  - Use QB online (can test QB sync)
- Provide hands-on onboarding, weekly check-ins, bug bounty
- Gather feedback: missing features, UX pain points, pricing feedback
- Document case study: "How Spend Management Improved Compliance"

### GA Rollout
- Announce feature to all customers (email, in-app banner)
- Provide webinar: "Managing Spend in Intrinsic" (walk-through, Q&A)
- Make spend controls optional (feature flag) initially, enable for all after 2 weeks
- Monitor adoption: % of customers provisioning cards, # transactions/day
- Track support tickets, iterate on UX

### Pricing
- Likely: add $20–50/user/month to existing Intrinsic subscription
  - Or: flat $500–1000/month per licensee (simpler)
  - Or: transaction-based: $0.25 per transaction (high volume = more revenue, but less predictable)
- Package: "Spend Management" is a premium add-on to base Intrinsic subscription

### Sales Enablement
- Help customers connect Divvy account (provide docs)
- Help customers connect QB account (OAuth flow is self-service)
- Success manager checks in 2 weeks post-launch: "How's the system working?"

---

## 14. Future Enhancements (v2+)

### Short-term (Months 6–9)
- Physical cards (5–7 day shipping)
- Real-time pre-approval checks (don't wait for manager approval, just flag risky spend)
- Merchant categorization rules (auto-code by merchant MCC)
- Budget forecasting (predict month-end spend based on YTD)
- Expense reimbursement (staff pay with personal card, request reimbursement)

### Medium-term (Months 9–12)
- Multi-card issuance per staff member (personal + business card)
- Recurring expense rules (utilities, insurance = auto-code)
- Spend policies (no alcohol, require 3 quotes for >$5k, etc.)
- Integration with other card processors (Stripe, Brex)
- Multi-currency support (international locations)

### Long-term (Months 12+)
- AI-powered spend anomaly detection (flag unusual merchant, category, amount)
- Predictive budgeting (suggest budget based on historical spend)
- Integration with HBSI rates (auto-adjust staffing budgets based on rate changes)
- Blockchain audit trail (immutable transaction log)
- Mobile app (iOS/Android)

---

## 15. References & Appendices

### Divvy API Docs
https://developer.divvy.com/docs

### AWS Textract Pricing
https://aws.amazon.com/textract/pricing/

### QB Online API Docs
https://developer.intuit.com/app/developer/qbo/docs/get-started/get-started-oauth

### HIPAA Compliance for Spend Management
- Cards processed by Divvy (not Intrinsic) — Divvy's BAA responsibility
- Receipts stored in S3 — Intrinsic's BAA responsibility (encrypt at rest)
- Transaction metadata (amount, merchant, date) — not PHI, can be logged/analyzed

### Accessibility
- All spend UX must be WCAG 2.1 AA compliant
- Forms must be keyboard-navigable
- Charts must have alt text / data tables
- Color coding (red/yellow/green) must include icons/labels (not color-only)

---

## Document History

| Date | Author | Change |
|------|--------|--------|
| 2026-06-12 | Claude Code | Initial plan (19-week MVP) |

