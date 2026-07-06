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
| 23 | Edit Expense | **Complete** |
| 24 | Error & Not-Found Pages | **Complete** |
| 25 | Delete Room | **Complete** |
| 26 | Room Settings (Rename + Regenerate Invite Code) | **Complete** |
| 27 | Expense Pagination (Load More) | **Complete** |
| 28 | Email Notifications (Resend) | **Complete** |
| 29 | Data Export (CSV) | **Complete** |
| 30 | Profile Settings Page | **Complete** |
| 31 | Shareable Invite Link (/join?code=) | **Complete** |
| 32 | Loading Skeletons | **Complete** |
| 33 | Onboarding / Empty-State CTAs | **Complete** |
| 34 | Rate Limiting (Upstash) | **Complete** |
| 35 | Stale Credit Display Fix + Tab Reorder | **Complete** |
| 36 | Balance Calculation Fix (findAllCreditsByRoom) | **Complete** |
| 37 | Credit Force-Exhaust Bug Fix (Apply Credit button missing) | **Complete** |
| 38 | Partial Credit Preserved After Proposal Confirm + Credit Visible to Payer | **Complete** |
| 39 | Spurious Credit Created When Payer Confirms a Proposal Settlement | **Complete** |
| 40 | Tab Reorder (Balances first) + Mobile Responsiveness Pass | **Complete** |
| 41 | Realtime Updates (Optimistic UI + Pusher + Refresh-on-Focus) | **Complete** (needs Pusher env vars) |
| 42 | Proposal-Aware Credit Detection & Consumption | **Complete** |
| 43 | Members Tab Redesign (Total Spent + Spending/Payments Split) | **Complete** |
| 44 | Sovereign Indigo UI (theme tokens + dark mode + Cut Badge icon + icon kit) | **Complete** |

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
- ~~Real-time updates (WebSockets)~~ — **Done in Phase 41** (Pusher Channels)
- UPI payment integration
- OCR bill scanning
- QR room joining
- Subscription plans
- Mobile app API

---

## Room Detail Tab Order (UI Convention)

**Default tab order for room detail pages:**
1. **Balances** (default/first) — Financial status, who owes whom
2. **Activity** (second) — Full transaction log, expense cards with credit status
3. **Members** (third) — Member list with personal transaction history

**Rationale:** Reordered in Phase 40 (user decision, reversing Phase 35): Balances is the first thing users want to check when opening a room.

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
| Balances tab first (Phase 40) | User decision: balances are the first thing to check when opening a room (reverses Phase 35 order) |
| Activity = Bank statement style | Reduce cognitive load, improve scannability |
| Unified feed with clear sections | Balance clarity vs detail without chaos |

---

## Environment Variables Needed

```env
DATABASE_URL=            # Neon connection string
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=    # For validating webhook payloads

# Realtime (Pusher Channels) — optional; app degrades to refresh-on-focus without them
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=          # e.g. ap2 (Mumbai)
NEXT_PUBLIC_PUSHER_KEY=  # same value as PUSHER_KEY
NEXT_PUBLIC_PUSHER_CLUSTER=  # same value as PUSHER_CLUSTER
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
- **Tab Order Fixed:** Activity (default) → Balances → Members (updated again in Phase 35)
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

## Phase 20: Activity Tab Credit Display — Single Source of Truth

**Bugs:** (1) Overpayer's shares on NEW expenses showed "Auto-credit" without the user ever applying credit — the Phase 13 client-side pool simulation silently consumed overpayment surplus. (2) The "💰 Credit remaining" line on cards showed the pool's stale leftover, never updating when credit was applied/consumed/returned via the real credit system.

**Root cause:** `computeStatuses` in `expense-list.tsx` predates the credit system (Phase 13) and ran a parallel credit implementation that was never reconciled with `user_credits`.

**Fix — DB is the single source of truth for all credit display:**

| Change | Detail |
|---|---|
| Pool no longer covers new shares | Expense shares always start PENDING (with Apply credit button); only DB `creditApplied > 0` marks them credit-covered. Removed `AUTO_CREDIT` status kind. |
| Pool surplus dropped after each settlement | Surplus becomes a `user_credit` (detectAndCreateCredit), so it leaves the cash pool — same money can't double-cover future shares. |
| Pending shares use cash remainder | `shareAmount − creditApplied` so settlements allocate only to the uncovered portion. |
| "Credit remaining" from DB | New `getRoomCredits` service (room-wide, membership-checked) → page → RoomTabs → ExpenseList. Shows `totalCredit − usedCredit` per (holder, owedBy) pair, once on the most recent expense card per pair. |
| Top banner from same prop | Removed the client-side `/credits` fetch; derives from server-provided credits, refreshes with `router.refresh()`. |

UI/read-path only — no migration, retroactively corrects displayed state.

---

## Phase 21: Activity Status Ordering — createdAt, not expense_date

**Bug:** Overpayer's share on an expense added AFTER their settlement still showed "Settled" (hiding the Apply credit button). `computeStatuses` stamped expense events at `expense_date` midnight while settlements use real timestamps — so any same-day (or backdated) expense sorted BEFORE the day's settlements, and the settlement's surplus covered it in the replay even though that surplus had already become a DB credit.

**Fix:** Event ordering in `computeStatuses` (and `latestExpenseForPair`) now uses `expenses.createdAt` — when the expense was actually entered — matching how `detectAndCreateCredit` saw the world at settlement time. `expense_date` remains for display/grouping only.

---

---

## Phase 23: Edit Expense

**Feature:** Pencil icon on expense cards (creator-only) opens a pre-populated edit dialog. Full replacement — title, amount, category, paidBy, date, notes, and split participants can all be changed.

**Guard:** If any participant on the expense has `creditApplied > 0`, the edit is blocked with a clear error (delete and re-add instead). This prevents orphaned credits.

**Changes:**
| Layer | Change |
|---|---|
| `expense.repository.ts` | Added `updateExpense()` and `deleteParticipantsByExpenseId()` |
| `expense.schema.ts` | Added `updateExpenseSchema` (alias of `addExpenseSchema`) |
| `expense.service.ts` | Added `updateExpense()` — auth check, credit guard, share recalc, activity log (`EXPENSE_EDITED`) |
| `app/api/rooms/[id]/expenses/[eid]/route.ts` | Added `PATCH` handler |
| `components/rooms/edit-expense-dialog.tsx` | New controlled dialog, pre-populated via `useEffect` on `open` change |
| `components/rooms/expense-list.tsx` | Added pencil button, `editingExpense` state, `notes` field to `Expense` interface |
| `components/rooms/room-tabs.tsx` | Added `notes` field to local `Expense` type |

*Last updated: Phase 44 — Complete. Sovereign Indigo UI: theme tokens, dark mode, Cut Badge brand icon, category icon kit.*

---

## Phase 44: Sovereign Indigo UI (Design System + Dark Mode + Brand Assets)

**Frontend-only redesign — zero changes to API routes, services, repositories, schemas, or DB.** The user selected the "Sovereign Indigo" proposal (Cut Badge icon B + light/dark toggle) after four design iterations.

**Design language:**
- **Indigo = brand** (buttons, links, active states) — evolution of the pre-existing indigo, not a rebrand
- **Gold = money** (`.btn-gold` shimmer on Add Expense / Record Settlement / Confirm; `.font-money` Fraunces serif + tabular-nums on ₹ figures)
- **Blue = credit** (banner, Apply-credit button, credit chips, `CreditTokenIcon`) — never gold, never confused with balances
- **Green/rose = owed/owes** (kept, with dark: variants); pending stays amber/muted, never red
- **No floating animations** (user decision — "floating doesn't look professional")

| Piece | Files |
|---|---|
| Token system (light + dark oklch) | `globals.css` — full Sovereign Indigo palette replaces shadcn neutral; `--gold` token; `.btn-gold` + `.font-money` utilities |
| Fonts | `layout.tsx` — Fraunces (`--font-fraunces`) via next/font for money figures + wordmark; Geist stays body |
| Dark mode | `next-themes` (class strategy) + `theme-provider.tsx`; `theme-toggle.tsx` (sun/moon) in header; light is default |
| Brand mark ("Cut Badge") | `src/app/icon.svg` (monoline SM paths, no font dependency), `apple-icon.png` + multi-size `favicon.ico` (generated via sharp), `splitmate-logo.tsx` header logo |
| Icon kit (replaces ALL emojis) | `src/components/icons/category-icons.tsx` — Rent/Groceries/Vegetables/Utilities/Wifi/Other + Coin/CoinStack/CreditToken, Duolingo-style flat vectors; `CategoryIcon` mapper (VEGETABLES icon exists for future use; DB enum unchanged) |
| Dark-mode sweep | All `(app)` pages, room components, dialogs, skeletons: hardcoded gray/white → theme tokens (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`) + `dark:` variants for semantic tints. Public pages (landing, join, terms, privacy) remain light-committed. |

**Regenerating brand assets:** `icon.svg` is the source of truth; apple-icon.png/favicon.ico were produced from it with sharp (see Phase 44 commit). Keep the three in sync if the mark changes.

**Verified:** `tsc --noEmit` clean, 49/49 tests pass, `next build` succeeds (only pre-existing lint warnings).

**Deployment (updated Phase 44):** The Vercel project is connected to the GitHub repo (`pavankondilla/splitmate`) — every branch push builds a Preview deployment, and every push/merge to `main` auto-deploys Production (splitmate.co.in). Manual `vercel deploy --prod` from a local machine is no longer needed. Rollback: `npx vercel rollback`.

---

## Phase 43: Members Tab Redesign (Total Spent + Spending/Payments Split)

**Goal:** Show each member's total spending and make the per-member history sum to it. Replaces the old mixed history list, which had three problems: green "+₹9,000 Paid for rent" next to red "−₹3,000 Share of wifi" (signs meant different things), the payer's own share was invisible, and settlements looked like extra spending.

**Definition:** `Total spent = sum of the member's share_amount across all expenses` — including their own share of bills they paid and shares covered by credit (credit is the member's own money from an earlier overpayment; user decision). `Paid out of pocket = sum of expense.amount where paidBy = member`. Both computed at read time from props — no schema/API changes, UI-only (`members-view.tsx`).

**Layout per member card:**
- **Collapsed row:** "Spent ₹X" sub-line replaces the email (email moved into the expanded panel).
- **Expanded panel:**
  1. **Summary strip** — Total Spent / Paid Out of Pocket / Balance (3-col grid).
  2. **Spending** — one line per expense share, oldest first: title, ✦ credit badge when creditApplied > 0 (shows partial amount if creditApplied < share; the real share amount stays visible), subtext "paid by X" or "paid the bill ₹total" when the member paid it. Neutral amounts, no +/− signs. Sum row at the bottom matches the card total.
  3. **Payments (settling up)** — settlements in their own neutral section ("Paid → X" / "Received from X"), so they can't be mistaken for spending. Hidden when empty.

Optimistic expenses/settlements from Phase 41 flow through unchanged (same props), so totals update instantly on add.

---

## Phase 42: Proposal-Aware Credit Detection & Consumption

**Bug:** A (Aiverse) saw "₹400 credit available" in the Balances tab even though A held no credit. Room scenario: Pavan overpaid A ₹500 (credit owed by A), applied ₹400 to wifi paid by Charan → proposal "A pays C ₹400". A then paid C ₹400 **twice** — once for A's own wifi share, once for the proposal.

**Root cause:** `confirmProposalsForSettlement` matched the proposal to the FIRST ₹400 settlement. When the SECOND ₹400 arrived, `detectAndCreateCredit` saw totalPaid ₹800 vs totalOwed ₹400 = ₹400 overpayment. The Phase 39 guard only subtracts **PROPOSED** proposals — this one was already **CONFIRMED** — so a spurious credit (userId=A, owedBy=C, ₹400, ACTIVE) was created. `GET /api/rooms/:id/credits` (used by the Balances-tab badge) returns credits held by the current user, so A saw ₹400 available; Phase 39's `myNet !== 0` UI guard didn't help because A's net was legitimately +₹300.

**Fixes:**

| File | Change |
|---|---|
| `proposal.repository.ts` | Added `findConfirmedProposalsByPair(roomId, fromUserId, toUserId)` |
| `credit.service.ts` | `detectAndCreateCredit` now also subtracts CONFIRMED proposal totals for the (payer→payee) pair from the overpayment. Proposals whose `sourceCreditId` is one of the payee's own credits owed by the payer are skipped (already covered by the `totalCreditDebt` subtraction — avoids double counting). |
| Data cleanup | Deleted the spurious credit row in room "memu" (holder=Aiverse, owedBy=Charan, ₹400, usedCredit=0). Deleted rather than exhausted: `detectAndCreateCredit`'s `existingTotal` dedup counts exhausted credits and would have suppressed future legitimate credits for the pair. Verified nothing referenced the row. |

**Second gap (found in audit, same family):** `consumeCreditsOnSettlement` computed the credit-return portion from raw `totalPaid`/`settlementAmount`, which include proposal payments. If the settlement payee also holds their own credit owed by the payer, a proposal payment (forwarding a third member's credit) would wrongly consume the payee's credit — and the Phase 35 force-exhaust could fire early on inflated `totalPaid`.

**Fix:** Before `computeCreditReturnPortion`, subtract (a) the portion of THIS settlement about to confirm pending proposals (via `getProposalsToConfirm` — the same matcher `confirmProposalsForSettlement` uses right after this hook, so the split is identical) and (b) confirmed proposal totals for the pair from past settlements. The force-exhaust check uses the adjusted `ownTotalPaid`. Flows without proposals for the pair are byte-identical to before (both adjustments are 0).

**Verified:** Replayed the fixed detect math against live data — totalOwed 40000, totalPaid 80000, confirmed proposals 40000 → adjusted overpayment 0 → no credit created. Typecheck clean, all 49 tests pass.

---

## Phase 24: Error & Not-Found Pages

**Problem:** Users hitting bad URLs, deleted rooms, or server errors got a blank Next.js crash screen with no navigation.

**Files added:**

| File | Purpose |
|---|---|
| `src/app/not-found.tsx` | Global 404 — shown for any unknown URL outside the app shell. Standalone branded page with links to Dashboard and Home. |
| `src/app/(app)/not-found.tsx` | App-scoped 404 — shown (with header) when `notFound()` is called inside the `(app)` group (e.g. deleted/forbidden rooms). |
| `src/app/(app)/error.tsx` | Error boundary inside the app shell — catches unhandled server/client errors, shows Error ID digest, Try Again + Back to Dashboard. |
| `src/app/error.tsx` | Global error boundary — catches catastrophic errors outside all layouts. Renders its own `<html>` as required by Next.js. |

**Room page** already called `notFound()` for `NotFoundError` and `ForbiddenError` — now lands on a proper page instead of a crash.

---

## Phase 35: Stale Credit Display Fix + Tab Reorder

**Bug:** After all debts were settled, a leftover partial credit (e.g. ₹100) kept appearing in the Activity and Balance tabs even though the room was fully settled.

**Root causes:**

| Cause | Location | Description |
|---|---|---|
| Orphaned partial credit | `consumeCreditsOnSettlement` | If credit was partially applied (e.g. ₹900 of ₹1,000 used), the remaining ₹100 was never exhausted because `computeCreditReturnPortion` returned 0 for exact-debt settlements — nothing triggered `isExhausted=true` |
| SETTLED status ≠ isExhausted | `confirmProposalsForSettlement` | `updateCreditStatus("SETTLED")` and `updateCreditUsed` were separate calls; proposal path only called the former, leaving `isExhausted=false` on settled credits |
| No server-side filter | `findCreditsByRoom` | Returned ALL credits regardless of state; filtering was left entirely to the UI |

**Fixes:**

| Layer | File | Change |
|---|---|---|
| Force-exhaust on full payment | `credit.service.ts` → `consumeCreditsOnSettlement` | After the main loop, if `totalPaid >= totalEffectiveOwed` (payer fully covered their expense debt), all remaining active credits for the pair are exhausted — they can never be applied again |
| Exhaust on proposal confirm | `credit.service.ts` → `confirmProposalsForSettlement` | Now reads credit record and calls `updateCreditUsed(totalCredit, true)` before `updateCreditStatus("SETTLED")` so both flags are always in sync |
| DB-level filter | `credit.repository.ts` → `findCreditsByRoom` | Added `isExhausted = false` AND `status != 'SETTLED'` filters — dead credits never reach the UI |

**Tab reorder:** Activity is now the default first tab (was Balances). Order: Activity → Balances → Members. Change in `room-tabs.tsx` (`defaultValue` + trigger order).

---

## Phase 36: Balance Calculation Fix (findAllCreditsByRoom)

**Bug:** After B applied credit to an expense paid by A (instant path), A's balance incorrectly showed "pay ₹X to B" even though everything was settled.

**Example scenario:**
- A pays rent ₹9,000 (split 3 ways). B pays A ₹3,500 (₹500 overpayment → B's credit).
- A pays wifi ₹1,500. B applies ₹500 credit to wifi share.
- A's balance showed −₹500 (owes B ₹500). Correct answer: ₹0.

**Root cause:** Phase 35 added `isExhausted = false` AND `status != 'SETTLED'` filters to `findCreditsByRoom` to prevent stale credits from appearing in the UI. However, `balance.service.ts` and `dashboard.service.ts` used that same filtered query for balance *calculation*. The balance formula has two virtual adjustments that must cancel each other:

| Adjustment | Source | After Phase 35 filter |
|---|---|---|
| `virtualReceiptsFromCredits` (for expense payer A) | Reads from `expense_participants` — not filtered | Still −₹500 |
| `virtualSettlementsPaid` (for A as credit's owedByUserId) | Reads from credit records — filtered out | **0** (should be +₹500) |

With SETTLED credits excluded, `virtualReceiptsFromCredits` deducted ₹500 from A's receivables but `virtualSettlementsPaid` could no longer add ₹500 back. The same bug affected `getPairwiseBalances` and dashboard balance.

**Fix:**

| Layer | File | Change |
|---|---|---|
| New repository function | `credit.repository.ts` | Added `findAllCreditsByRoom` — no exhausted/status filter, used only for balance math |
| Balance calculation | `balance.service.ts` (`getRoomBalances`, `getPairwiseBalances`) | Switched from `findCreditsByRoom` to `findAllCreditsByRoom` |
| Dashboard calculation | `dashboard.service.ts` | Switched from `findCreditsByRoom` to `findAllCreditsByRoom` |

`findCreditsByRoom` (filtered) remains in use only by `credit.service.ts` → `getRoomCredits` for UI display.

---

## Phase 37: Credit Force-Exhaust Bug Fix (Apply Credit Button Missing)

**Bug:** B has ₹400 credit visible in the balance/banner, but no "Apply Credit" button appears on any expense card.

**Root cause:** Phase 35 added a force-exhaust block at the end of `consumeCreditsOnSettlement`:

```javascript
if (totalPaid >= totalEffectiveOwed) {
  for (const credit of activeCredits) {
    await creditRepo.updateCreditUsed(credit.id, credit.totalCredit, true);
  }
}
```

`activeCredits` = payee B's credits owed by payer A. When A makes ANY settlement to B (e.g. paying A's own expense share to B), and `totalEffectiveOwed = 0` (B has never paid any shared expense, so A has no expense debt to B), the condition `totalPaid >= 0` is trivially TRUE. This exhausted ALL of B's active credits — including a fresh ₹400 credit from B overpaying A for rent — even though the settlement had nothing to do with those credits.

**Result:** `findCreditsByRoom` filters `isExhausted = true` credits, so `availableCredit = 0` in `ExpenseList`, and `canApplyCredit` returns false → no button.

**Fix:** Two guards added in `credit.service.ts` → `consumeCreditsOnSettlement`:

1. `totalEffectiveOwed > 0` — skips the entire force-exhaust block when the payer has no expense debt to the payee, preventing the `0 >= 0` always-true trap.
2. `credit.usedCredit > 0` — only exhausts partially-consumed credits (the original Phase 35 intent: stale leftover fractions). Fresh credits (`usedCredit === 0`) are untouched and remain valid for future expense applications.

```javascript
// Before (bug):
if (totalPaid >= totalEffectiveOwed) {
  for (const credit of activeCredits) {
    await creditRepo.updateCreditUsed(credit.id, credit.totalCredit, true);
  }
}

// After (fix):
if (totalEffectiveOwed > 0 && totalPaid >= totalEffectiveOwed) {
  for (const credit of activeCredits) {
    if (credit.usedCredit > 0) {
      await creditRepo.updateCreditUsed(credit.id, credit.totalCredit, true);
    }
  }
}
```

**Phase 35 behavior preserved:** Partially-consumed credits (`usedCredit > 0`) are still exhausted when the payer has fully paid their expense debt — the original stale-credit scenario still works correctly.

**File changed:** `src/services/credit.service.ts` only. No schema migration needed.

---

## Phase 38: Partial Credit Preserved After Proposal Confirm + Credit Visible to Payer

**Bugs (3-member scenario: A pays rent, B overpays ₹500 credit, C pays wifi, B applies ₹400 credit):**

1. A (expense payer) could not see B's available credit in the Activity tab before B applied it anywhere.
2. After B applied ₹400 of ₹500 credit (proposal path, A→C ₹400) and A confirmed the proposal, B's remaining ₹100 credit was silently wiped — the Apply Credit button disappeared on A's grocery expense.
3. Pairwise balances showed wrong amounts after proposal confirmation because the credit adjustment was gated on `status === "SETTLED"`, which was no longer true for partial credits.

**Root causes:**

| Bug | Location | Cause |
|---|---|---|
| Credit invisible to payer | `expense-list.tsx` `creditHolders` filter | `p.creditApplied > 0` guard prevented unapplied credits from appearing |
| Remaining credit wiped on proposal confirm | `credit.service.ts` `confirmProposalsForSettlement` | `updateCreditUsed(id, credit.totalCredit, true)` force-set `usedCredit` to full amount regardless of how much was actually used |
| Wrong pairwise balance after partial confirm | `balance.service.ts` `getPairwiseBalances` | Credit adjustment loop skipped `status !== "SETTLED"` credits; partial credits restored to `ACTIVE` (Fix 2) were excluded |

**Fixes:**

| File | Change |
|---|---|
| `expense-list.tsx` | Removed `&& p.creditApplied > 0` from `creditHolders` filter — the `remaining <= 0` inner guard already prevents zero-balance lines |
| `credit.service.ts` | `confirmProposalsForSettlement` now keeps `usedCredit = credit.usedCredit` (set correctly by `applyCredit`); only marks `isExhausted=true` and `status=SETTLED` if `usedCredit >= totalCredit`, otherwise restores `status=ACTIVE` |
| `balance.service.ts` | Removed `if (credit.status !== "SETTLED") continue` from credit adjustment loop in `getPairwiseBalances`; relies on `autoUsed > 0` (derived from `creditConfirmed` participants) — naturally 0 for pending/unapplied credits, non-zero only for confirmed ones |

**`lib/balance.ts` (`computeNetBalance`) unchanged** — its `proposalCovered` subtraction already cancels the credit adjustment for the proposal-path portion, giving the correct net regardless of credit status.

---

## Phase 39: Spurious Credit Created When Payer Confirms a Proposal Settlement

**Bug:** After A settled B's credit proposal (A paid C to confirm the proposal), A's Activity and Balances tabs showed "₹400 credit available" even though all balances were ₹0 and everything was settled.

**Root cause:** In `recordSettlement`, `detectAndCreateCredit` runs BEFORE `confirmProposalsForSettlement`. When A paid C ₹400 to confirm B's proposal, `detectAndCreateCredit` saw A paying C with no expense debt to C, treated the full ₹400 as overpayment, and created a spurious credit: `userId=A, owedByUserId=C, totalCredit=400`. Pending proposals (which explain the payment as forwarding B's credit debt) were never checked.

**Fixes:**

| File | Change |
|---|---|
| `credit.service.ts` | `detectAndCreateCredit` now queries pending proposals for (payerId→payeeId) pair and subtracts their total from the overpayment before creating a credit. `proposalAdjustedOverpayment ≤ 0` → no credit created. Prevents future spurious credits. |
| `expense-list.tsx` | Credit banner now requires `hasApplicableShare` — the user must have at least one pending expense share (`status=PENDING`, `creditApplied=0`) to see the "credit available" notification. A stale credit in a fully-settled room has no applicable shares → banner suppressed. |
| `balance-view.tsx` | Credit badge in Balances tab now requires `myNet !== 0`. A real credit always produces positive net balance; `myNet=0` with credit showing is always a spurious artifact. |

---

## Phase 40: Tab Reorder (Balances First) + Mobile Responsiveness Pass

**Tab reorder (user decision, reverses Phase 35):** Balances is now the default first tab. Order: Balances → Activity → Members (`room-tabs.tsx` `defaultValue` + trigger order).

**Mobile fixes (UI-only, no backend changes):**

| File | Change |
|---|---|
| `room-tabs.tsx` | Header row stacks on mobile (`flex-col` → `sm:flex-row`); TabsList full-width with equal-width triggers on mobile; action button row wraps (`flex-wrap`) |
| `ui/dialog.tsx` | `DialogContent` gets global `max-h-[calc(100dvh-2rem)] overflow-y-auto` so long forms scroll instead of clipping on short screens |
| `add-expense-dialog.tsx` | Trigger label shortens to "Add" on mobile (`sm:hidden` / `hidden sm:inline` spans) |
| `record-settlement-dialog.tsx` | Default trigger label shortens to "Settle" on mobile (custom `triggerLabel` unaffected) |
| `expense-list.tsx` | Participant rows in expanded split details wrap (`flex-wrap`) so "Pending + Apply credit + amount" doesn't overflow; participant names truncate |
| `balance-view.tsx` | Profile card: name column gets `min-w-0` + `truncate`; balance figure is `text-2xl sm:text-3xl` |
| `members-view.tsx` | Role badge hidden on mobile (`hidden sm:inline-flex`); member names truncate |
| `rooms/[id]/page.tsx` | Room title gets `min-w-0` + `break-words` so long names wrap instead of pushing Export CSV off-screen |

---

## Phase 41: Realtime Updates (Optimistic UI + Pusher + Refresh-on-Focus)

**Problem:** Every mutation used `router.refresh()` alone — a 1–2s dead gap before the UI updated, and other members never saw changes until manual reload.

**Three-layer fix (no schema changes; balances stay server-computed per ledger rule):**

**1. Optimistic UI (own actions feel instant):**
| File | Change |
|---|---|
| `room-tabs.tsx` | Owns `useOptimistic` for expenses (add/remove) and settlements (add); passes optimistic arrays to ExpenseList/MembersView and callbacks to dialogs. Balances/pairwise are NEVER optimistically recomputed — only the raw lists. |
| `add-expense-dialog.tsx` | After POST success, builds an `OptimisticExpense` (shares via `calculateEqualShares` — same function as server) and calls `onOptimisticAdd` inside the `startTransition` that wraps `router.refresh()`, so it displays until real data lands |
| `record-settlement-dialog.tsx` | Same pattern with `OptimisticSettlement` (exported type); `onBehalfOfAmount: 0` default |
| `expense-list.tsx` | Optimistic delete: card removed via `onExpenseRemoved` inside the refresh transition; empty-state AddExpenseDialog wired too |
| `balance-view.tsx` | Passes `onOptimisticSettlement` into its Settle Now / proposal RecordSettlementDialogs |

**Key pattern:** the optimistic update MUST be called inside the same `startTransition` as `router.refresh()` — React keeps the optimistic state visible exactly until the refresh delivers fresh server props, then reconciles automatically. No rollback code needed (mutation already succeeded before the optimistic insert).

**2. Pusher realtime (roommates see changes in ~1s):**
| File | Change |
|---|---|
| `lib/realtime.ts` | Server publisher. Lazy-inits Pusher from env; `publishRoomUpdate(roomId)` triggers `"updated"` (empty payload — clients refetch through authorized paths) on channel `room-{id}`. No-op if env missing, never throws. |
| `activity-log.repository.ts` | Single publish point: every mutation already calls `logActivity`, which now schedules `publishRoomUpdate` via `after()` (falls back to fire-and-forget outside request scope, e.g. tests) |
| `components/realtime/room-realtime.tsx` | Client subscriber on room page. Module-level shared Pusher connection (connection count = billed resource); 400ms debounce coalesces multi-event mutations (settlement + credit hooks) into one `router.refresh()` |

**3. Refresh-on-focus (stale tabs self-heal):**
| File | Change |
|---|---|
| `components/realtime/refresh-on-focus.tsx` | On window focus/visibilitychange → throttled (5s min) `router.refresh()`. Mounted once in `(app)/layout.tsx` — covers dashboard, rooms, profile. |

**Deployment requirement:** create a Pusher Channels app and set the 6 env vars (see Environment Variables). Without them the app still works — realtime silently disabled, refresh-on-focus still active. Dashboard has no Pusher subscription (would need per-user multi-room channels) — it relies on refresh-on-focus.
