/**
 * One-time bulk import of the store's product list (~5,300 SKUs) into
 * InventoryItem. Source data comes from a pre-parsed JSON dump of the
 * owner's spreadsheet (name / brand / opening stock / unit — no price,
 * filled in later via the Inventory page).
 *
 * Usage:
 *   npx tsx scripts/import-inventory.ts <path-to-json> --dry-run
 *   npx tsx scripts/import-inventory.ts <path-to-json>
 *
 * Dry-run prints the category-mapping breakdown and skip counts without
 * writing anything, so the mapping can be sanity-checked before committing
 * ~5,300 real rows to the shared production database.
 */
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../lib/generated/prisma/client";

interface SourceRow {
  name: string;
  brand: string | null;
  stock: number;
  unit: string;
}

/** Normalizes the spreadsheet's free-text Unit column into the app's fixed
 * `UNIT_TYPE_OPTIONS` set (Pcs/Box/Dozen/PKT/Set). */
function normalizeUnit(raw: string): string {
  const cleaned = raw.replace(/\.$/, "").trim().toLowerCase();
  if (cleaned === "box") return "Box";
  if (cleaned === "dozen") return "Dozen";
  if (cleaned === "pkt") return "PKT";
  if (cleaned === "set" || cleaned === "units") return "Set";
  return "Pcs";
}

/** Brands that are exclusively/predominantly innerwear (bras/panties). */
const INNERWEAR_BRANDS = new Set([
  "jockey",
  "amante",
  "sona",
  "bodycare",
  "floret",
  "lily",
  "effectinn",
  "enamor",
  "vanheusen",
  "teenager",
]);

/** Keyword → category rules, checked against the lowercased item name.
 * Order matters: first match wins. Applied after brand-level rules, so a
 * brand's own predominant category (e.g. innerwear brands) is checked first,
 * then falls through to these name-based signals. This is a one-time,
 * best-effort categorization — not claimed to be perfect for all ~5,300
 * rows; individual items can be recategorized later via the Inventory page. */
const KEYWORD_RULES: Array<{ category: string; keywords: string[] }> = [
  {
    category: "Bangles",
    keywords: ["bangle", "churi", "kada"],
  },
  {
    category: "Innerwear",
    keywords: ["bra ", "bra(", "panty", "panties", "m/set", "m-set", "brassiere"],
  },
  {
    category: "Handbag",
    keywords: ["handbag", "hand bag", "vanity case", "cosmetics bag", "cosmetic bag", "pouch", "purse"],
  },
  {
    category: "Accessories",
    keywords: [
      "hair clip",
      "hair pin",
      "hairpin",
      "hair rubber",
      "comb",
      "kamar belt",
      "baju band",
    ],
  },
  {
    category: "Jewellery",
    keywords: [
      "earring",
      "necklace",
      "chain",
      "locket",
      "finger ring",
      "ring",
      "payal",
      "bracelet",
      "braclet",
      "imitation",
      "nath",
      "tikka",
      "kalira",
    ],
  },
  {
    category: "Accessories",
    keywords: ["paranda", "juda"],
  },
  {
    category: "Innerwear",
    keywords: ["shapewear", "nighty"],
  },
  {
    category: "Makeup",
    keywords: ["makeup brush", "makeup fixer", "makeup kit", "highlighter", "blender"],
  },
  {
    category: "Skincare",
    keywords: ["body milk"],
  },
  {
    category: "Skincare",
    keywords: [
      "face wash",
      "facewash",
      "scrub",
      "serum",
      "toner",
      "moisturiser",
      "moisturizer",
      "sunscreen",
      "sun stopper",
      "sunex",
      "spf",
      "cleanser",
      "mask",
      "peel",
      "cream",
      "lotion",
      "soft cream",
    ],
  },
  {
    category: "Makeup",
    keywords: [
      "lipstick",
      "lip ",
      "kajal",
      "nail",
      "foundation",
      "compact",
      "mascara",
      "eyeliner",
      "eyebrow",
      "kumkum",
      "sindoor",
      "bindi",
      "gloss",
      "concealer",
      "primer",
      "powder",
    ],
  },
];

function categorize(name: string, brand: string | null): string {
  const lowerName = name.toLowerCase();
  const lowerBrand = brand?.toLowerCase().trim() ?? "";

  if (INNERWEAR_BRANDS.has(lowerBrand)) return "Innerwear";

  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => lowerName.includes(kw))) {
      return rule.category;
    }
  }

  // Cosmetics/skincare brands not caught by a name keyword above default to
  // Makeup (the majority use case for these brands in this catalog).
  const cosmeticsBrands = new Set([
    "lakme",
    "nykaa",
    "faces canada",
    "sugar",
    "colorbar",
    "kay beauty",
    "pilgrim",
    "lotus organics+",
    "oshea",
    "chambor",
    "vega",
    "skinn",
    "jovees",
    "dot & key",
    "just hurb",
    "maybelline",
    "praush",
    "paris beauty",
    "biotique",
    "vlcc",
    "minimalist",
    "pop",
    "quench",
    "lotus",
    "monti carlo",
    "hok",
    "garnier",
    "ponds",
    "bodykool",
    "vini",
    "foxtale",
    "lipstick",
  ]);
  if (cosmeticsBrands.has(lowerBrand)) return "Makeup";

  return "Other";
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const filePath = args.find((a) => !a.startsWith("--"));
  if (!filePath) {
    console.error("Usage: npx tsx scripts/import-inventory.ts <path-to-json> [--dry-run]");
    process.exit(1);
  }

  const rows: SourceRow[] = JSON.parse(readFileSync(filePath, "utf-8"));
  console.log(`Read ${rows.length} rows from ${filePath}`);

  const categoryCounts = new Map<string, number>();
  const prepared = rows.map((row) => {
    const category = categorize(row.name, row.brand);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    return {
      name: row.name,
      category,
      brand: row.brand,
      unitType: normalizeUnit(row.unit),
      ratePerUnit: 0,
      quantity: row.stock,
      lowStockThreshold: 5,
    };
  });

  console.log("\nCategory breakdown:");
  for (const [category, count] of [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${category.padEnd(14)} ${count}`);
  }

  if (dryRun) {
    console.log("\nDry run — no rows written. Re-run without --dry-run to import.");
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const CHUNK_SIZE = 500;
  let created = 0;
  for (let i = 0; i < prepared.length; i += CHUNK_SIZE) {
    const chunk = prepared.slice(i, i + CHUNK_SIZE);
    const result = await prisma.inventoryItem.createMany({ data: chunk, skipDuplicates: true });
    created += result.count;
    console.log(`Imported ${created}/${prepared.length}...`);
  }

  console.log(`\nDone. Created ${created} inventory items.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
