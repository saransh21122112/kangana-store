"use client"

import { motion } from "framer-motion"

/**
 * Next.js's `template.tsx` convention (unlike `layout.tsx`) creates a new
 * component instance on every navigation, which is what actually powers
 * this transition — not a `key={pathname}` + `AnimatePresence` pairing.
 *
 * That was the first approach (see git history / MEMORY.md "Stage 16"):
 * wrapping `{children}` in `AppShell` with `usePathname()` as an
 * `AnimatePresence` key. It looked correct and matched common tutorials,
 * but reliably produced a real bug, caught by `testing/e2e/delete-flows.
 * spec.ts` (two identical, both-visible `<h1>` elements after navigating to
 * a customer profile — not a rendering fluke, reproduced 5/5 runs). Root
 * cause: `usePathname()` and the `children` prop can update on different
 * render ticks, so the "exiting" element gets updated in place with the
 * *new* page's content before its key changes, and a second, genuinely
 * fresh instance mounts alongside it — both showing the new page.
 * `template.tsx` sidesteps the whole class of bug: Next.js itself
 * guarantees a fresh instance per navigation, so there's no key/children
 * synchronization for this component to get wrong. Enter-only (no exit
 * animation) is the tradeoff, but a correct, boring transition beats a
 * broken, duplicated one.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  )
}
