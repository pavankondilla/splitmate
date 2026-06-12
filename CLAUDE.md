# SplitMate — Project Reference

> This file is the single source of truth for architecture decisions, rules, and progress.
> Never deviate from this without explicit user approval.

---

## Project Identity

- **Name:** SplitMate
- **Type:** SaaS Web Application
- **Domain:** Roommate expense sharing and rent management
- **Target:** Indian market (INR, UPI-ready future)

---

## Tech Stack (Locked)

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode) |
| Database | Neon PostgreSQL (serverless) |
| ORM | Drizzle ORM |
| Auth | Clerk |
| Validation | Zod |
| Styling | Tailwind CSS |
| UI Components | Shadcn UI |
| Deployment | Vercel |

---

## Architecture Rules (Never Deviate)

1. **Backend first.** No frontend page until the service layer for that feature is complete.
2. **Ledger accounting.** Never store a computed balance. Always derive balances from `expense_participants` and `settlements`.
3. **Store amounts as integers (paise).** ₹15,000 = `1500000`. No floats for money.
4. **UUIDs everywhere.** No serial/auto-increment IDs.
5. **Soft deletes.** Use `deleted_at` timestamp, never hard delete expenses or rooms.
6. **Clerk is the auth source of truth.** Our `users` table stores only `clerk_id` + display info. Sync via Clerk webhook.
7. **Zod validates at the API boundary.** No raw `req.body` usage anywhere.
8. **Every mutation is logged** to `activity_logs`.
9. **Split type stored from day 1** even if only EQUAL is implemented in MVP.
10. **Authorization checked in service layer**, not just middleware.

---

## Folder Structure (Target)

```
src/
├── app/                          # Next.js App Router pages & API routes
│   ├── api/
│   │   ├── rooms/
│   │   ├── expenses/
│   │   ├── settlements/
│   │   ├── dashboard/
│   │   └── webhooks/clerk/
│   └── (pages)/
├── db/
│   ├── schema/                   # Drizzle table definitions
│   │   ├── users.ts
│   │   ├── rooms.ts
│   │   ├── room-members.ts
│   │   ├── expenses.ts
│   │   ├── expense-participants.ts
│   │   ├── settlements.ts
│   │   └── activity-logs.ts
│   ├── index.ts                  # DB connection (Neon + Drizzle)
│   └── migrations/               # Drizzle generated migrations
├── modules/                      # Feature-grouped business units
│   ├── rooms/
│   ├── expenses/
│   ├── settlements/
│   └── dashboard/
├── repositories/                 # Data access layer (DB queries only)
│   ├── room.repository.ts
│   ├── expense.repository.ts
│   ├── settlement.repository.ts
│   └── user.repository.ts
├── services/                     # Business logic layer
│   ├── room.service.ts
│   ├── expense.service.ts
│   ├── settlement.service.ts
│   ├── balance.service.ts        # Core ledger computation
│   └── dashboard.service.ts
├── schemas/                      # Zod validation schemas
│   ├── room.schema.ts
│   ├── expense.schema.ts
│   └── settlement.schema.ts
├── lib/
│   ├── auth.ts                   # Clerk server-side helpers
│   ├── errors.ts                 # Custom error classes
│   └── utils.ts
└── types/
    ├── api.ts                    # Request/response types
    └── domain.ts                 # Core domain types
```

---

## Database Schema Plan

### Table: `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| clerk_id | VARCHAR UNIQUE | FK to Clerk |
| email | VARCHAR | |
| name | VARCHAR | |
| avatar_url | TEXT | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### Table: `rooms`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR | |
| invite_code | VARCHAR UNIQUE | 8-char random |
| invite_expires_at | TIMESTAMP | nullable |
| created_by | UUID FK → users | |
| currency | VARCHAR(3) | default 'INR' |
| deleted_at | TIMESTAMP | soft delete |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### Table: `room_members`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| room_id | UUID FK → rooms | |
| user_id | UUID FK → users | |
| role | ENUM(admin, member) | |
| joined_at | TIMESTAMP | |
| deleted_at | TIMESTAMP | soft delete |

### Table: `expenses`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| room_id | UUID FK → rooms | |
| title | VARCHAR | |
| amount | INTEGER | paise |
| category | ENUM | RENT, GROCERIES, UTILITIES, WIFI, OTHER |
| split_type | ENUM | EQUAL, PERCENTAGE, EXACT, SHARES |
| paid_by | UUID FK → users | |
| notes | TEXT | nullable |
| expense_date | DATE | |
| deleted_at | TIMESTAMP | soft delete |
| created_by | UUID FK → users | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### Table: `expense_participants`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| expense_id | UUID FK → expenses | |
| user_id | UUID FK → users | |
| share_amount | INTEGER | paise — what this person owes |
| share_percentage | DECIMAL | nullable, for future |
| is_settled | BOOLEAN | default false |

### Table: `settlements`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| room_id | UUID FK → rooms | |
| payer_id | UUID FK → users | person paying |
| payee_id | UUID FK → users | person receiving |
| amount | INTEGER | paise |
| note | TEXT | nullable |
| settled_at | TIMESTAMP | |
| created_by | UUID FK → users | |
| created_at | TIMESTAMP | |

### Table: `activity_logs`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| room_id | UUID FK → rooms | nullable |
| actor_id | UUID FK → users | who did it |
| action | VARCHAR | e.g. EXPENSE_ADDED, SETTLEMENT_MADE |
| entity_type | VARCHAR | expense / settlement / room |
| entity_id | UUID | |
| metadata | JSONB | before/after snapshot |
| created_at | TIMESTAMP | |

---

## Balance Calculation Logic

```
For user A in a room:

total_owed_to_A = SUM(share_amount WHERE user_id != A AND expense.paid_by = A)
total_A_owes    = SUM(share_amount WHERE user_id = A AND expense.paid_by != A)

settlements_A_received = SUM(amount WHERE payee_id = A)
settlements_A_paid     = SUM(amount WHERE payer_id = A)

net_balance = (total_owed_to_A - settlements_A_received)
            - (total_A_owes - settlements_A_paid)

positive = others owe you
negative = you owe others
```

---

## API Routes Plan

```
POST   /api/rooms                    Create room
GET    /api/rooms                    List my rooms
GET    /api/rooms/:id                Get room detail + members
POST   /api/rooms/join               Join via invite code
DELETE /api/rooms/:id/leave          Leave room

POST   /api/rooms/:id/expenses       Add expense
GET    /api/rooms/:id/expenses       List room expenses
DELETE /api/rooms/:id/expenses/:eid  Soft delete expense

POST   /api/rooms/:id/settlements    Record settlement
GET    /api/rooms/:id/settlements    List settlements

GET    /api/rooms/:id/balances       Computed balances for room
GET    /api/dashboard                Summary across all rooms

POST   /api/webhooks/clerk           Sync Clerk user to DB
```

---

## Build Phases & Status

| Phase | Description | Status |
|---|---|---|
| 1 | Project Architecture & Structure | **Complete** |
| 2 | Database Schema (Drizzle) | **Complete** |
| 3 | Drizzle Migrations | **Complete** |
| 4 | Auth Integration (Clerk + webhook) | **Complete** |
| 5 | Repository Layer | **Complete** |
| 6 | Service Layer + Balance Logic | **Complete** |
| 7 | API Routes | **Complete** |
| 8 | Zod Validation | **Complete** |
| 9 | Testing | **Complete** |
| 10 | Frontend (pages + components) | **Complete** |
| 11 | Production Deployment (Vercel + Clerk + splitmate.co.in) | **Complete** |
| 12 | Bug fixes + Mobile responsiveness | **Complete** |
| 13 | UI/UX Refinements (Activity feed, Member history, Balances) | **Complete** |

---

## MVP Scope (What We Build Now)

- Equal splits only
- One currency (INR)
- Room-level expense tracking
- Simple pairwise balance display
- Manual settlements
- Basic dashboard

## Post-MVP (Schema-ready but not implemented)

- Uneven splits (PERCENTAGE, EXACT, SHARES)
- Recurring rent
- Real-time updates (WebSockets)
- UPI payment integration
- OCR bill scanning
- QR room joining
- Subscription plans
- Mobile app API

---

## Room Detail Tab Order (UI Convention)

**Default tab order for room detail pages:**
1. **Balances** (default/first) — Financial status, who owes whom
2. **Members** (second) — Member list with personal transaction history
3. **Activity** (third) — Detailed transaction log (reference only)

**Rationale:** Users open a room wanting to know financial status first, then dive into details.

---

## Activity Section Design (Bank-Statement Style)

**Layout:** Two sub-sections for clarity and scannability
1. **Expenses** — Bills added by members
2. **Settlements** — Payments made between members

**Format:** One transaction per line (bank-statement style)
```
Title  |  Category  |  ₹Amount  |  Paid by X  |  Date
────────────────────────────────────────────────────
room rent  RENT  ₹9,000  Pavan  12 Jun
```

**Visual distinction:**
- Expenses: Blue card background
- Settlements: Green card background
- Minimal clutter, maximum scanability

**Rationale:** Roommates need to quickly understand "what happened" without confusion. Matches familiar bank app UX.

---

## Key Decisions Log

| Decision | Reason |
|---|---|
| Integers for money | Avoid float precision bugs |
| Soft deletes | Audit trail integrity |
| Compute balances, don't store | Prevents inconsistency bugs |
| Clerk webhook for user sync | Clerk is source of truth for identity |
| `split_type` from day 1 | Avoid painful future migration |
| Invite code expiry field | Ready for security hardening |
| Balances tab first | Users need financial status immediately |
| Activity = Bank statement style | Reduce cognitive load, improve scannability |
| Unified feed with clear sections | Balance clarity vs detail without chaos |

---

## Environment Variables Needed

```env
DATABASE_URL=            # Neon connection string
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=    # For validating webhook payloads
```

---

## Project Location
`D:\SplitMate\` (moved from C drive due to disk space — C had only 0.3GB free)

---

## Known Bug Fixes Applied

| Bug | Fix | Phase |
|---|---|---|
| Balance shows wrong numbers after expense deletion | Clamped negative debt values in `getPairwiseBalances` | Phase 12 |
| Auth loop on sign-in | `requireDbUser()` auto-upserts user if webhook hasn't fired; middleware redirects away from auth pages | Phase 12 |
| Pairwise balances returning empty when not settled | Rewrote `getPairwiseBalances()` to derive from net balances using greedy algorithm instead of broken debt map | Phase 13 |
| Members tab balance inconsistent with Balances tab | Members tab now uses authoritative balance from API instead of recalculating | Phase 13 |
| Balance view not showing who owes whom | Added sub-notes under each member showing pairwise debts (e.g., "Pavan owes ₹1000") | Phase 13 |

---

## Phase 14: Member Management & Access Control

| Feature | Description |
|---|---|
| **Member Removal** | Admin-only removal of room members (like WhatsApp). Shows confirmation with balance, unsettled count, warnings. Member must be settled (balance ≥ 0) before removal. Logs activity with `removedBy` tracking. |
| **Expense Delete (Alternative 2)** | Creator-only deletion. Admins can no longer delete other members' expenses. Maintains creator accountability. |
| **Database Schema** | Added `removedBy` column to room_members table (UUID FK to users) to track who removed each member. |
| **API Route** | `DELETE /api/rooms/[id]/members/[memberId]` — permission checks, balance validation, activity logging. |

---

## Phase 13 Features (UI/UX Refinements)

- **Unified Activity Feed:** Merged expenses and settlements into single timeline (sorted by date)
- **Member Personal History:** Click to expand member card and see their complete transaction history (like PhonePay statement)
- **Balance Clarity:** Added "Who owes whom" notes under each member's balance
- **Fixed Pairwise Logic:** Now correctly derives from net balances (greedy algorithm)
- **Consistent Balance Calculation:** Members tab and Balances tab now show same values
- **Activity Tab Redesign:** Parent-child card structure — each expense is a parent card with expandable split details showing each participant's status (Settled / Pending / Auto-credit). Settlements appear as standalone green cards. Date grouping (Today / Yesterday / date). Running-balance algorithm derives per-participant status across the full expense+settlement timeline.
- **Tab Order Fixed:** Balances (default) → Members → Activity
- **Balances Tab Redesign (Option 3):** Person-centric view — each member's card shows "You owe X ₹Y" and "Z owes you ₹Y" clearly. Removed abstract pairwise section. Intuitive and non-confusing.

---

## Phase 16: Credit System & Balance Calculation Overhaul

**Critical bugs fixed:**

| Bug | Root Cause | Fix |
|---|---|---|
| Credit banner showing after settlement | `detectAndCreateCredit()` ignored existing credits; created spurious new credit on settlement returns | Check payee's historical credits owed by payer before declaring overpayment |
| Balance showing -₹1,300 instead of -₹1,000 | `computeNetBalance()` didn't account for `creditApplied` on participant shares | Added `virtualReceiptsFromCredits`: sum creditApplied on expense payer's shares |
| Auto-credit not reflected in expense payer's balance | Auto-credit only updated the expense participant, not the payer's balance | Pass `creditApplied` field through balance calc; reduce `totalOwedToUser` by auto-credited amounts |
| Random settlement numbers after credit use | `usedCredit` was double-counted: both as expense auto-credit AND as settlement-return | Cap `usedCredit` at true expense auto-credit amount; exclude settlement-return portion |

**Key logic changes:**

1. **`consumeCreditsOnSettlement(payerId, payeeId, amount, roomId)`**: When payer settles to payee, exhausts payee's credits owed by payer (if any). Called after every settlement.

2. **`computeNetBalance()` now includes:**
   - `virtualSettlementsPaid`: Credits owed by user where usedCredit ≤ true expense auto-credit amount
   - `virtualReceiptsFromCredits`: Sum of creditApplied on user's own expense shares
   - Formula: `netBalance = (totalOwedToUser - settlementsReceived - virtualReceiptsFromCredits) - (totalUserOwes - settlementsPaid - virtualSettlementsPaid)`

3. **`getPairwiseBalances()` cap fix**: Only counts auto-credited portion of usedCredit, not settlement-return portion.

**Works for any room size** (3, 4, 5+ members). Auto-credit propagates correctly across all expense participants.

---

## Phase 18: Credit System Hardening

| Issue | Fix |
|---|---|
| Settlement for normal expense debt wrongly consumed payee's credit | `consumeCreditsOnSettlement` now only consumes the surplus portion of a settlement beyond the payer's effective expense debt (`computeCreditReturnPortion` in `lib/credit.ts`, unit-tested) |
| Deleting an expense orphaned applied credit | `restoreCreditsForDeletedExpense`: dismisses PROPOSED proposals + refunds their credit, refunds instant-settled credit, resets participant credit fields. CONFIRMED proposals (real money moved) untouched. Called from `deleteExpense`. |
| `creditConfirmed` set while proposals still pending (mixed credit sources) | `applyCredit` confirms the share only if zero proposals were created; `confirmProposalsForSettlement` confirms only when the last pending proposal for that share resolves |
| Credit hook failure could fail an already-recorded settlement | Hooks in `recordSettlement` are best-effort with error logging (neon-http has no transactions; balances derive from raw ledger so they stay correct) |
| Stray debug file `D:SplitMatequery-room.js` in root | Moved to `scripts/query-room.js`; `.claude/` gitignored |

---

## Phase 19: Proposal Settlement Attribution

**Bug:** When a proposal settlement was recorded (e.g. Aiverse pays Pavan ₹300 on behalf of Charan's credit), it was indistinguishable from Aiverse paying his own share. The ₹300 was counted twice in balances (once as the real settlement, once via virtual credit adjustments), and the Activity tab wrongly marked Aiverse's own share as settled.

**Design principle:** Virtual credit adjustments (`virtualSettlementsPaid` / `virtualReceiptsFromCredits`) exist ONLY for the instant path (credit owed by the expense payer — no settlement row exists). Proposal-path credits resolve via a REAL settlement, which is already counted in `settlementsPaid`/`settlementsReceived` — virtuals must exclude proposal-covered portions.

**Changes:**

| Layer | Change |
|---|---|
| `lib/balance.ts` | `computeNetBalance` accepts `confirmedProposals`; subtracts proposal-covered amounts (per credit and per participant) from both virtual sums |
| `balance.service.ts` | `getPairwiseBalances` excludes proposal-covered portions of settlements from the generic pair loop (the SETTLED-credit adjustment reattributes them to the credit pair) |
| `dashboard.service.ts` | Now passes credits + confirmed proposals (was ignoring credits entirely) |
| `settlement.service.ts` | `getRoomSettlements` annotates each settlement with `onBehalfOfAmount` / `onBehalfOfUserId` (derived from confirmed proposals via `confirmedSettlementId`) |
| `expense-list.tsx` | `computeStatuses` only feeds the payer's OWN portion of a settlement into the share-matching pool; settlement cards show "Includes ₹X for Y's credit" |

**No schema migration** — classification happens at read time via `settlement_proposals.confirmed_settlement_id`, which naturally handles a settlement that covers both a proposal and the payer's own share.

**Verified with the 3-member scenario** (rent ₹9,000 + ₹1,000 overpayment + ₹900 groceries + credit apply + proposal settle): Aiverse −₹1,000, Charan +₹700, Pavan +₹300. Regression tests in `balance.test.ts` cover pre-confirmation, post-confirmation, and instant-path states.

---

*Last updated: Phase 19 — Complete. Proposal settlements correctly attributed. App stable at splitmate.co.in.*
