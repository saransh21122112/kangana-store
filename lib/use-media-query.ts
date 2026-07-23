"use client"

import { useSyncExternalStore } from "react"

/**
 * SSR-safe media query hook built on useSyncExternalStore (rather than
 * useState+useEffect) so there's no setState-in-effect render cascade.
 * Server snapshot is always `false` — the client re-syncs on hydration.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onStoreChange)
      return () => mql.removeEventListener("change", onStoreChange)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}

/** True only after the component has mounted on the client. Useful for
 * gating rendering that depends on client-only state (e.g. next-themes'
 * resolvedTheme) to avoid hydration mismatches. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}
