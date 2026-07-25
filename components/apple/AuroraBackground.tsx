import { cn } from "@/lib/utils"

export interface AuroraBackgroundProps {
  className?: string
}

/**
 * Fixed, full-viewport decorative background: three large blurred blobs in
 * the brand's rose/gold palette (plus a violet third tone for dark mode
 * only, since two tones alone read flat once large enough), slowly
 * drifting via CSS keyframes. `pointer-events-none` so it never interferes
 * with interaction.
 *
 * Deliberately rendered with NO explicit z-index (not `-z-10`) — `AppShell`
 * wraps every page in its own opaque `bg-background` div, which doesn't
 * establish a CSS stacking context of its own; a `fixed` descendant with a
 * *negative* z-index gets hoisted up and painted below that ancestor's
 * background instead of behind just the page's own content, making it
 * invisible. Rendering this as the first child with the default `z-index:
 * auto` relies on plain DOM paint order instead — every later sibling
 * (headings, cards) naturally paints on top without needing an explicit
 * z-index of its own.
 *
 * Deliberately opt-in (not global) — see the "Futuristic glass/glow preview
 * layer" comment in globals.css for why this is scoped to Login + Dashboard
 * only rather than replacing the app-wide background.
 *
 * Light mode keeps this very low-opacity (a shop counter screen in
 * daylight needs the page to stay legible, not "wow"); dark mode is where
 * the neon glow actually shows up.
 */
export function AuroraBackground({ className }: AuroraBackgroundProps) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 overflow-hidden", className)}
    >
      {/* Faint tech grid, dark mode only — a classic sci-fi HUD cue. Kept at
          a very low opacity (4%) so it reads as texture, not clutter, and
          is masked to fade out toward the edges rather than hard-cutting. */}
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--gold) 60%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--gold) 60%, transparent) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          opacity: 0.05,
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)",
        }}
      />
      <div
        className="aurora-blob absolute left-[10%] top-[-10%] size-[38rem] rounded-full bg-accent/[0.08] blur-[100px] dark:bg-accent/35"
        style={{ animation: "aurora-drift-1 22s ease-in-out infinite" }}
      />
      <div
        className="aurora-blob absolute right-[5%] top-[10%] size-[32rem] rounded-full bg-gold/[0.08] blur-[100px] dark:bg-gold/35"
        style={{ animation: "aurora-drift-2 26s ease-in-out infinite" }}
      />
      <div
        className="aurora-blob absolute bottom-[-15%] left-[25%] hidden size-[34rem] rounded-full bg-[oklch(0.55_0.2_300)]/28 blur-[100px] dark:block"
        style={{ animation: "aurora-drift-3 30s ease-in-out infinite" }}
      />
    </div>
  )
}
