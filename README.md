# Kangna Beauty & Jewellery CRM

A CRM for a beauty & jewellery store: customer profiles, visit/billing history with live rollup
stats, automatic segment lists (birthdays, anniversaries, inactive, top spenders), WhatsApp
outreach, per-bill PDF invoices, a dashboard, global search & notifications, and settings — built
with an Apple-HIG inspired UI. Three roles (OWNER / STAFF / VIEWER) control access: VIEWER is
strictly read-only, and deleting a bill or customer is OWNER-only.

**Live:** [kangnafaizabad.vercel.app](https://kangnafaizabad.vercel.app)

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript strict |
| Styling | Tailwind CSS v4 + shadcn/ui (base-ui) |
| Database | PostgreSQL (Neon, via Vercel Marketplace) |
| ORM | Prisma 7 (driver-adapter client, `@prisma/adapter-pg`) |
| Auth | NextAuth v5 (Credentials provider, JWT sessions, OWNER/STAFF/VIEWER roles) |
| Messaging | WhatsApp `wa.me` link-mode (Cloud API stubbed, not implemented) |
| Forms | react-hook-form + zod (shared client/server validation) |
| Charts | Recharts |
| PDF | `@react-pdf/renderer` (per-bill invoice download) |
| Motion | framer-motion (`template.tsx` route transitions, list/card stagger) |
| Testing | Playwright Test (`testing/e2e/`, manual-trigger e2e + automatic CI typecheck/lint/build) |
| Hosting | Vercel (Functions + Cron) |

## Architecture

```mermaid
flowchart TB
    subgraph client["Browser"]
        UI["Next.js App Router UI<br/>(Server + Client Components)<br/>template.tsx route transitions"]
        CMDK["⌘K / Ctrl+K Command Palette"]
        WA["wa.me links<br/>(opened client-side)"]
        PDFDL["Bill PDF download<br/>(a[download] → browser)"]
    end

    subgraph edge["Vercel"]
        PROXY["proxy.ts (middleware)<br/>session gate only —<br/>logged in or not, no role logic"]
        CRON["Vercel Cron<br/>08:00 IST daily"]
    end

    subgraph app["Next.js Server (Vercel Functions)"]
        PAGES["App Router Pages<br/>Dashboard · Customers · Bills<br/>Lists · Campaigns · Settings<br/>— each redirects STAFF/VIEWER<br/>away from routes it can't use"]
        API["Route Handlers<br/>/api/customers /api/bills<br/>/api/messages /api/notifications<br/>DELETE bills/customers (OWNER only)"]
        PDFRT["/api/bills/[id]/pdf<br/>@react-pdf/renderer"]
        CRONRT["/api/cron/daily-check<br/>(CRON_SECRET gated)"]
        AUTH["NextAuth v5<br/>Credentials + bcrypt + JWT"]
        GUARD["requireRole()<br/>OWNER / STAFF / VIEWER gate<br/>— VIEWER: reads only, no writes"]
    end

    subgraph domain["Domain Logic (lib/)"]
        QCUST["queries/customers.ts<br/>deleteCustomer() cascades<br/>Bill + MessageLog"]
        QBILL["queries/bills.ts<br/>recalculateCustomerRollup()<br/>deleteBill()"]
        QLIST["queries/customer-lists.ts<br/>birthdays · anniversaries<br/>inactive · top spenders"]
        QDASH["queries/dashboard-stats.ts"]
        QMSG["queries/message-templates.ts<br/>queries/message-log.ts"]
        QSET["queries/settings.ts"]
        WAM["whatsapp/link-mode.ts<br/>buildWaMeLink()"]
        PDFLIB["pdf/bill-invoice.tsx<br/>BillInvoiceDocument"]
    end

    subgraph data["Data Layer"]
        PRISMA["Prisma Client<br/>(pg driver adapter)"]
        PG[("Neon Postgres<br/>Customer · Bill · User<br/>MessageTemplate · MessageLog<br/>OwnerNotification · AppSettings")]
    end

    UI -->|"fetch"| API
    UI --> PAGES
    CMDK -->|"/api/search"| API
    PDFDL -->|"GET"| PDFRT
    PAGES -->|"server-side calls"| QCUST & QBILL & QLIST & QDASH & QSET

    UI -.->|"every request"| PROXY
    PROXY -->|"unauthenticated → /login<br/>unauthenticated API → 401 JSON"| UI
    PROXY --> AUTH

    API --> GUARD
    PDFRT --> GUARD
    GUARD --> AUTH
    API --> QCUST & QBILL & QMSG & QSET
    PDFRT --> QBILL
    PDFRT --> PDFLIB

    CRON -->|"Authorization: Bearer CRON_SECRET"| CRONRT
    CRONRT --> QLIST

    QMSG --> WAM
    WAM -->|"wa.me/91••••••••••?text=..."| WA

    QCUST & QBILL & QLIST & QDASH & QMSG & QSET --> PRISMA
    PRISMA --> PG

    style client fill:#0A84FF22,stroke:#0A84FF
    style edge fill:#34C75922,stroke:#34C759
    style app fill:#AF52DE22,stroke:#AF52DE
    style domain fill:#FF9F0A22,stroke:#FF9F0A
    style data fill:#8E8E9322,stroke:#8E8E93
```

### Request flow (a customer sends a WhatsApp birthday message)

```mermaid
sequenceDiagram
    actor Owner
    participant UI as Customer Profile (client)
    participant API as /api/messages/send
    participant Guard as requireRole()
    participant Tpl as message-templates.ts
    participant Log as message-log.ts
    participant DB as Neon Postgres

    Owner->>UI: Open "Send Message" sheet, pick BIRTHDAY template
    UI->>UI: renderTemplate() — live preview with {{name}}, {{loyaltyPoints}}...
    Owner->>UI: Click "Send via WhatsApp"
    UI->>API: POST { customerId, templateId }
    API->>Guard: requireRole(["OWNER"])
    Guard-->>API: session ok
    API->>Tpl: renderTemplate(body, customer)
    API->>DB: buildWaMeLink() + create MessageLog (status: SENT)
    DB-->>API: logged
    API-->>UI: { waLink }
    UI->>Owner: window.open(waLink) → WhatsApp opens pre-filled
```

## Core Data Model

```mermaid
erDiagram
    Customer ||--o{ Bill : "has"
    Customer ||--o{ MessageLog : "receives"
    MessageTemplate ||--o{ MessageLog : "renders into"
    Bill ||--o{ BillLineItem : "line items"
    BillLineItem ||--o{ BillReturn : "returns"
    InventoryItem ||--o{ BillLineItem : "sold as"
    User ||--o{ ActivityLog : "acted"

    Customer {
        string id PK
        string name
        string mobileNumber UK
        datetime birthday
        datetime anniversary
        float totalPurchaseAmount
        int totalVisits
        float averageBillValue
        datetime lastVisitDate
        string favouriteCategory
        int loyaltyPoints
    }
    Bill {
        string id PK
        string billNo UK
        datetime date
        float amount
        string customerId FK
    }
    BillLineItem {
        string id PK
        string billId FK
        string category
        string inventoryItemId FK
        int quantity
        float unitPrice
        float lineTotal
    }
    BillReturn {
        string id PK
        string lineItemId FK
        int quantityReturned
        float amountReturned
        string reason
        string createdById FK
    }
    InventoryItem {
        string id PK
        string name
        string category
        int quantity
        int lowStockThreshold
    }
    MessageTemplate {
        string id PK
        enum type
        string body
        boolean isActive
    }
    MessageLog {
        string id PK
        string customerId FK
        enum status
        datetime sentAt
    }
    User {
        string id PK
        string email UK
        string password
        enum role
    }
    AppSettings {
        string id PK
        string storeName
        string[] categories
        int inactiveThreshold30
        float loyaltyPointsPerRupee
    }
    ActivityLog {
        string id PK
        string userId FK
        string userEmail
        string action
        string entityType
        string entityId
        string summary
    }
```

`Bill` is a header row over a `BillLineItem[]` "shopping cart" — each line item carries its own
category, optional link to a tracked `InventoryItem`, quantity, and price (unit price × quantity,
or a flat line total). Every `Bill` create/update/delete runs inside a Prisma transaction that
recomputes the owning `Customer`'s rollup fields (`totalPurchaseAmount`, `totalVisits`,
`averageBillValue`, `lastVisitDate`, `favouriteCategory`) from scratch — never incrementally — so
they stay correct regardless of edit/delete/return order; `BillReturn` rows net out of
`totalPurchaseAmount`/`favouriteCategory` but don't touch `Bill.amount` itself, which stays the
original sale total. Loyalty points are earned automatically on sale (`AppSettings.loyaltyPointsPerRupee`)
and clawed back on delete/return, plus support manual adjustment. `ActivityLog` is an OWNER-only
audit trail of customer/bill create/update/delete actions.

## Getting Started

```bash
npm install                 # runs `prisma generate` via postinstall
cp .env.example .env        # fill in DATABASE_URL, NEXTAUTH_SECRET, etc.
npx prisma migrate deploy
npx prisma db seed          # optional: seeds demo customers/templates
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Required environment variables:

```
DATABASE_URL=              # pooled Postgres connection string
DATABASE_URL_UNPOOLED=     # direct connection, used for migrations
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
WHATSAPP_MODE=link         # "link" (wa.me) or "api" (Cloud API — not implemented)
CRON_SECRET=                # protects /api/cron/daily-check
```

## Testing

`npx tsc --noEmit` and `npm run lint` run automatically on every push/PR via
`.github/workflows/ci.yml`. The Playwright e2e suite (`testing/e2e/`, `npm run test:e2e`) runs
against a real `npm run dev` instance and the real database — there's no separate test DB for this
app — so it's manual-trigger-only (`.github/workflows/e2e.yml`, run from the GitHub Actions tab),
never automatically on push. See `testing/e2e/README.md` for the data-safety rules the suite
follows (throwaway test users, non-destructive delete-flow checks, cleanup guarantees).

## Deployment

Hosted on Vercel with Postgres provisioned via the Vercel Marketplace (Neon). A daily
`vercel.json` cron job hits `/api/cron/daily-check` to generate owner notifications for
today's birthdays/anniversaries and customers crossing inactivity thresholds.
