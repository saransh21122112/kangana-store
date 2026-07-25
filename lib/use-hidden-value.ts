"use client"

import { useSyncExternalStore, useCallback } from "react"

/**
 * Persisted show/hide toggle for a single sensitive value (e.g. a Total
 * Sales figure someone might not want visible on a shop-counter screen).
 * Backed by localStorage, keyed per caller so multiple tiles can each have
 * their own independent hidden state. Built on `useSyncExternalStore` (same
 * pattern as `useMounted`/`useMediaQuery` in this file's sibling) rather
 * than `useState` + a `useEffect` localStorage sync, so there's no
 * setState-in-effect render cascade and the value starts correctly on the
 * very first client render.
 */

const listeners = new Map<string, Set<() => void>>()

function getSnapshot(storageKey: string): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(storageKey) === "hidden"
}

function subscribe(storageKey: string, callback: () => void): () => void {
  if (!listeners.has(storageKey)) listeners.set(storageKey, new Set())
  listeners.get(storageKey)!.add(callback)
  return () => listeners.get(storageKey)?.delete(callback)
}

function notify(storageKey: string): void {
  listeners.get(storageKey)?.forEach((callback) => callback())
}

export function useHiddenValue(storageKey: string): [hidden: boolean, toggle: () => void] {
  const hidden = useSyncExternalStore(
    (callback) => subscribe(storageKey, callback),
    () => getSnapshot(storageKey),
    () => false
  )

  const toggle = useCallback(() => {
    const next = !getSnapshot(storageKey)
    window.localStorage.setItem(storageKey, next ? "hidden" : "visible")
    notify(storageKey)
  }, [storageKey])

  return [hidden, toggle]
}
