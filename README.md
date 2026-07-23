# Kangna Beauty & Jewellery CRM

A CRM for a beauty & jewellery store: customer profiles, visit/billing history with live rollup
stats, automatic segment lists (birthdays, anniversaries, inactive, top spenders), WhatsApp
outreach, a dashboard, global search & notifications, and settings — built with an Apple-HIG
inspired UI.

**Live:** [kangana-crm.vercel.app](https://kangana-crm.vercel.app)

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript strict |
| Styling | Tailwind CSS v4 + shadcn/ui (base-ui) |
| Database | PostgreSQL (Neon, via Vercel Marketplace) |
| ORM | Prisma 7 (driver-adapter client, `@prisma/adapter-pg`) |
| Auth | NextAuth v5 (Credentials provider, JWT sessions, OWNER/STAFF roles) |
| Messaging | WhatsApp `wa.me` link-mode (Cloud API stubbed, not implemented) |
| Forms | react-hook-form + zod (shared client/server validation) |
| Charts | Recharts |
| Motion | framer-motion |
| Hosting | Vercel (Functions + Cron) |

## Architecture

```mermaid
flowchart TB
    subgraph client["Browser"]
        UI["Next.js App Router UI<br/>(Server + Client Components)"]
        CMDK["⌘K Command Palette"]
        WA["wa.me links<br/>(opened client-side)"]
    end

    subgraph edge["Vercel"]
        PROXY["proxy.ts (middleware)<br/>session gate + role redirects"]
        CRON["Vercel Cron<br/>08:00 IST daily"]
    end

    subgraph app["Next.js Server (Vercel Functions)"]
        PAGES["App Router Pages<br/>Dashboard · Customers · Bills<br/>Lists · Campaigns · Settings"]
        API["Route Handlers<br/>/api/customers /api/bills<br/>/api/messages /api/notifications"]
        CRONRT["/api/cron/daily-check<br/>(CRON_SECRET gated)"]
        AUTH["NextAuth v5<br/>Credentials + bcrypt + JWT"]
        GUARD["requireRole()<br/>OWNER / STAFF gate"]
    end

    subgraph domain["Domain Logic (lib/)"]
        QCUST["queries/customers.ts"]
        QBILL["queries/bills.ts<br/>recalculateCustomerRollup()"]
        QLIST["queries/customer-lists.ts<br/>birthdays · anniversaries<br/>inactive · top spenders"]
        QDASH["queries/dashboard-stats.ts"]
        QMSG["queries/message-templates.ts<br/>queries/message-log.ts"]
        QSET["queries/settings.ts"]
        WAM["whatsapp/link-mode.ts<br/>buildWaMeLink()"]
    end

    subgraph data["Data Layer"]
        PRISMA["Prisma Client<br/>(pg driver adapter)"]
        PG[("Neon Postgres<br/>Customer · Bill · User<br/>MessageTemplate · MessageLog<br/>OwnerNotification · AppSettings")]
    end

    UI -->|"fetch"| API
    UI --> PAGES
    CMDK -->|"/api/search"| API
    PAGES -->|"server-side calls"| QCUST & QBILL & QLIST & QDASH & QSET

    UI -.->|"every request"| PROXY
    PROXY -->|"unauthenticated → /login<br/>authenticated API → 401 JSON"| UI
    PROXY --> AUTH

    API --> GUARD
    GUARD --> AUTH
    API --> QCUST & QBILL & QMSG & QSET

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
    API->>Guard: requireRole(["OWNER","STAFF"])
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
    }
    Bill {
        string id PK
        string billNo UK
        datetime date
        float amount
        string category
        string customerId FK
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
    }
```

Every `Bill` create/update/delete runs inside a Prisma transaction that recomputes the owning
`Customer`'s rollup fields (`totalPurchaseAmount`, `totalVisits`, `averageBillValue`,
`lastVisitDate`, `favouriteCategory`) from scratch — never incrementally — so they stay correct
regardless of edit/delete order.

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

## Deployment

Hosted on Vercel with Postgres provisioned via the Vercel Marketplace (Neon). A daily
`vercel.json` cron job hits `/api/cron/daily-check` to generate owner notifications for
today's birthdays/anniversaries and customers crossing inactivity thresholds.
