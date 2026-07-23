import {
  Gem,
  Sparkles,
  Droplet,
  Palette,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react"

/**
 * Shared default rendering convention for every icon in the app:
 * strokeWidth 1.75, ~20-24px, matching Apple HIG's slightly-thin SF Symbols
 * feel. Spread this into any lucide-react icon: `<Icon {...ICON_PROPS} />`.
 */
export const ICON_PROPS = {
  size: 20,
  strokeWidth: 1.75,
} as const

/**
 * Maps a bill/product *category* string to a representative lucide icon.
 *
 * This is intentionally a small, easily-extendable seed list — the exact
 * category taxonomy (e.g. "Jewellery-Gold", "Jewellery-Diamond",
 * "Skincare-Face", ...) will be finalized in a later billing stage. When
 * that happens, add more specific keys here (lowercased) rather than
 * reworking the shape of this map.
 *
 * Lookup is case-insensitive by convention: callers should lowercase the
 * category key before indexing, e.g. `CATEGORY_ICON_MAP[cat.toLowerCase()]
 * ?? CATEGORY_ICON_MAP.default`.
 */
export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  jewellery: Gem,
  beauty: Sparkles,
  skincare: Droplet,
  makeup: Palette,
  default: ShoppingBag,
}

/**
 * Convenience getter that always falls back to the default icon, so callers
 * never have to null-check.
 */
export function getCategoryIcon(category: string | undefined | null): LucideIcon {
  if (!category) return CATEGORY_ICON_MAP.default
  return CATEGORY_ICON_MAP[category.toLowerCase()] ?? CATEGORY_ICON_MAP.default
}
