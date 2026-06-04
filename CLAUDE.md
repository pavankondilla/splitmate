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

## Key Decisions Log

| Decision | Reason |
|---|---|
| Integers for money | Avoid float precision bugs |
| Soft deletes | Audit trail integrity |
| Compute balances, don't store | Prevents inconsistency bugs |
| Clerk webhook for user sync | Clerk is source of truth for identity |
| `split_type` from day 1 | Avoid painful future migration |
| Invite code expiry field | Ready for security hardening |

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

| Bug | Fix |
|---|---|
| Balance shows wrong numbers after expense deletion | Clamped negative debt values in `getPairwiseBalances` and clamped over-settlement in `computeNetBalance` |
| Auth loop on sign-in | `requireDbUser()` now auto-upserts user if webhook hasn't fired; middleware redirects authenticated users away from auth pages |

---

*Last updated: Phase 12 — Complete. App is live at splitmate.co.in. Balance bug fixed. Mobile responsive.*
