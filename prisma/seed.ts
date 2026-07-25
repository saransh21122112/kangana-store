/**
 * Stage 2 seed script.
 *
 * Seeds:
 *  - 1 OWNER user for login testing (Stage 10 — Auth).
 *      email:    owner@kangnabeauty.in
 *      password: password123   (bcrypt-hashed before insert; plaintext documented
 *                                here and in MEMORY.md purely for local dev/testing)
 *  - 25 realistic Indian-name customers with varied gender/locality/category/dates.
 *  - 1-8 bills per customer spread over the last 12 months.
 *  - 6 default MessageTemplate rows (one per non-CUSTOM MessageType).
 *
 * Rollup fields (totalPurchaseAmount / totalVisits / averageBillValue /
 * lastVisitDate / favouriteCategory) decision:
 *   We DO compute and write these after inserting each customer's bills, using
 *   the same aggregate logic the real rollup maintenance (Stage 4 billing
 *   module) will use — sum(amount), count(*), avg(amount), max(date), and the
 *   most-frequent category ("mode") among that customer's bills. This is safer
 *   than leaving them at schema defaults (0/null) because later stages (e.g.
 *   dashboard stat tiles, VIP/segment filters) may be built and manually
 *   spot-checked against this seed data before Stage 4's billing module exists
 *   to keep them live-updated — defaults of 0 everywhere would make that data
 *   look broken/empty rather than just "not yet wired to write path". Stage 4
 *   is still the source of truth for keeping these correct as new bills come
 *   in after seeding.
 */

import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { Gender, MessageType } from "../lib/generated/prisma/enums";

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const CATEGORIES = ["Jewellery", "Beauty", "Skincare", "Makeup"] as const;

const AREAS = [
  "Andheri West",
  "Bandra East",
  "Malad",
  "Borivali",
  "Dadar",
  "Chembur",
  "Powai",
  "Vashi",
  "Thane",
  "Goregaon",
];

const FIRST_NAMES = [
  "Priya",
  "Anjali",
  "Neha",
  "Kavita",
  "Sunita",
  "Pooja",
  "Ritu",
  "Sneha",
  "Divya",
  "Meera",
  "Rohit",
  "Amit",
  "Vikram",
  "Rajesh",
  "Suresh",
  "Karan",
  "Arjun",
  "Manoj",
  "Deepak",
  "Sanjay",
  "Aarti",
  "Kiran",
  "Nisha",
  "Swati",
  "Rekha",
];

const LAST_NAMES = [
  "Sharma",
  "Verma",
  "Gupta",
  "Iyer",
  "Nair",
  "Patel",
  "Shah",
  "Mehta",
  "Kapoor",
  "Reddy",
  "Joshi",
  "Desai",
  "Rao",
  "Chopra",
  "Malhotra",
];

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

function seededRandom(seed: number) {
  // simple deterministic-ish PRNG per index, good enough for varied-but-stable dummy data
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function daysFromToday(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function randomPastDate(withinDays: number, rnd: () => number): Date {
  const daysAgo = Math.floor(rnd() * withinDays);
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

async function main() {
  // --- OWNER user ---
  const plaintextPassword = "password123";
  const hashedPassword = await bcrypt.hash(plaintextPassword, 10);

  await prisma.user.upsert({
    where: { email: "owner@kangnabeauty.in" },
    update: {},
    create: {
      name: "Kangna Store Owner",
      email: "owner@kangnabeauty.in",
      password: hashedPassword,
      role: "OWNER",
    },
  });

  // --- Customers ---
  // Build 25 customers. Indices 0-4 get "this week" birthday/anniversary dates
  // computed relative to *today* (new Date()), so this stays true no matter
  // when the seed is re-run — including one deliberately ~2 days before today
  // (which naturally crosses a month boundary whenever today is near the 1st
  // of a month; otherwise it's still a valid "within this week" case).
  type CustomerSeed = {
    name: string;
    mobileNumber: string;
    gender: Gender;
    areaLocality: string;
    birthday: Date | null;
    anniversary: Date | null;
    favouriteCategoryHint: string;
  };

  const genders: Gender[] = [
    Gender.MALE,
    Gender.FEMALE,
    Gender.OTHER,
    Gender.UNSPECIFIED,
  ];

  const customers: CustomerSeed[] = [];

  for (let i = 0; i < 25; i++) {
    const rnd = seededRandom(i + 1);
    const first = pick(FIRST_NAMES, i);
    const last = pick(LAST_NAMES, i + Math.floor(i / 3));
    const name = `${first} ${last}`;
    // unique 10-digit Indian-looking mobile number: starts 6-9, then 9 more digits
    const mobileNumber = `9${String(800000000 + i * 137 + 1234).padStart(9, "0")}`;

    let birthday: Date | null = null;
    let anniversary: Date | null = null;

    if (i === 0) {
      // birthday 2 days from today (this week, forward)
      birthday = daysFromToday(2);
    } else if (i === 1) {
      // anniversary 3 days from today (this week, forward)
      anniversary = daysFromToday(3);
    } else if (i === 2) {
      // birthday 2 days BEFORE today — exercises month/year-boundary wraparound
      // whenever today is near the start of a month (e.g. today - 2 days lands
      // in the previous month/year).
      birthday = daysFromToday(-2);
    } else if (i === 3) {
      // anniversary 5 days from today (still within a 7-day "this week" window)
      anniversary = daysFromToday(5);
    } else if (i === 4) {
      // birthday 1 day from today
      birthday = daysFromToday(1);
    } else if (rnd() > 0.5) {
      // scatter some far-off, "not this week" birthdays/anniversaries for contrast
      birthday = rnd() > 0.5 ? randomPastDate(3650, rnd) : null;
      anniversary = rnd() > 0.6 ? randomPastDate(3650, rnd) : null;
    }
    // remaining customers: birthday/anniversary stay null (mix of set vs unset)

    customers.push({
      name,
      mobileNumber,
      gender: pick(genders, i),
      areaLocality: pick(AREAS, i),
      birthday,
      anniversary,
      favouriteCategoryHint: pick(CATEGORIES, i),
    });
  }

  const createdCustomerIds: string[] = [];

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    const customer = await prisma.customer.upsert({
      where: { mobileNumber: c.mobileNumber },
      update: {},
      create: {
        name: c.name,
        mobileNumber: c.mobileNumber,
        birthday: c.birthday,
        anniversary: c.anniversary,
        areaLocality: c.areaLocality,
        gender: c.gender,
        loyaltyPoints: (i * 37) % 500,
        notes: null,
        customerSince: randomPastDate(365 * 3, seededRandom(i + 100)),
      },
    });
    createdCustomerIds.push(customer.id);
  }

  // --- Bills (1-8 per customer, spread over last 12 months) ---
  // Stage 21: Bill is a header row over BillLineItem[] — each seeded bill
  // gets exactly one line item (single category/amount, matching this
  // script's original one-category-per-bill flavor of seed data), created
  // in the same nested-write shape `createBillWithRollup` uses for real
  // bills rather than the old flat category/amount columns (dropped from
  // the schema once every query/UI path stopped depending on them).
  let billCounter = 1;

  for (let i = 0; i < createdCustomerIds.length; i++) {
    const customerId = createdCustomerIds[i];
    const rnd = seededRandom(i + 500);
    const numBills = 1 + Math.floor(rnd() * 8); // 1..8

    for (let b = 0; b < numBills; b++) {
      const category = pick(CATEGORIES, i + b);
      const amount = Math.round((500 + rnd() * 15000) * 100) / 100;
      const date = randomPastDate(365, rnd);
      const billNo = `INV-2026-${String(billCounter).padStart(5, "0")}`;
      billCounter++;

      await prisma.bill.create({
        data: {
          billNo,
          date,
          amount,
          customerId,
          lineItems: {
            create: [{ category, quantity: 1, lineTotal: amount }],
          },
        },
      });
    }

    // --- Compute rollups the same way real rollup-maintenance logic would ---
    const bills = await prisma.bill.findMany({
      where: { customerId },
      include: { lineItems: true },
    });
    const totalPurchaseAmount = bills.reduce((sum, x) => sum + x.amount, 0);
    const totalVisits = bills.length;
    const averageBillValue = totalVisits > 0 ? totalPurchaseAmount / totalVisits : 0;
    const lastVisitDate =
      bills.length > 0
        ? bills.reduce((max, x) => (x.date > max ? x.date : max), bills[0].date)
        : null;

    // mode category (most frequent), weighted by lineTotal — mirrors
    // `recalculateCustomerRollup`'s tie-break logic.
    const freq = new Map<string, { amount: number; count: number }>();
    for (const bill of bills) {
      for (const lineItem of bill.lineItems) {
        const entry = freq.get(lineItem.category) ?? { amount: 0, count: 0 };
        entry.amount += lineItem.lineTotal;
        entry.count += 1;
        freq.set(lineItem.category, entry);
      }
    }
    let favouriteCategory: string | null = null;
    let best: { amount: number; count: number } | null = null;
    for (const [cat, entry] of freq) {
      if (!best || entry.amount > best.amount || (entry.amount === best.amount && entry.count > best.count)) {
        best = entry;
        favouriteCategory = cat;
      }
    }

    await prisma.customer.update({
      where: { id: customerId },
      data: {
        totalPurchaseAmount,
        totalVisits,
        averageBillValue,
        lastVisitDate,
        favouriteCategory,
      },
    });
  }

  // --- Message templates: one default per non-CUSTOM MessageType ---
  const templates: { type: MessageType; title: string; body: string }[] = [
    {
      type: MessageType.BIRTHDAY,
      title: "Birthday Wish",
      body: "Happy Birthday {{name}}! 🎉 Wishing you a year filled with joy and sparkle. Visit us this week for a special birthday treat!",
    },
    {
      type: MessageType.ANNIVERSARY,
      title: "Anniversary Wish",
      body: "Happy Anniversary {{name}}! 💍 Celebrate the occasion with something beautiful — just for you.",
    },
    {
      type: MessageType.FESTIVAL,
      title: "Festival Greeting",
      body: "Wishing you and your family a very Happy {{festival}}, {{name}}! ✨ Explore our festive collection in store.",
    },
    {
      type: MessageType.NEW_ARRIVALS,
      title: "New Arrivals",
      body: "Hi {{name}}, our new collection just arrived! Come take a look before your favourites sell out.",
    },
    {
      type: MessageType.MONTHLY_OFFER,
      title: "Monthly Offer",
      body: "Hi {{name}}, this month only — enjoy {{discount}}% off on {{category}}. Don't miss out!",
    },
    {
      type: MessageType.WE_MISS_YOU,
      title: "We Miss You",
      body: "Hi {{name}}, it's been a while since your last visit! We miss you — come say hello, we have something special waiting.",
    },
  ];

  for (const t of templates) {
    const existing = await prisma.messageTemplate.findFirst({ where: { type: t.type } });
    if (!existing) {
      await prisma.messageTemplate.create({ data: t });
    }
  }

  console.log("Seed complete.");
  console.log(`OWNER login -> email: owner@kangnabeauty.in, password: ${plaintextPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
