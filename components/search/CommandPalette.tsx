"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { format } from "date-fns"

import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { Avatar } from "@/components/apple/Avatar"
import { ICON_PROPS } from "@/lib/icon-map"
import type { SearchCustomerResult } from "@/lib/queries/search"

const DEBOUNCE_MS = 300

/** Custom event name used to open the palette from outside (e.g. a mobile search button that has no keyboard to press Cmd-K on). See `openCommandPalette()` / `CommandPaletteTrigger` below. */
const OPEN_EVENT = "kangna:open-command-palette"

/** Call from anywhere (e.g. a button's onClick) to open the globally-mounted CommandPalette. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

/**
 * Global Cmd/Ctrl-K command palette, mounted once in app/(app)/layout.tsx so
 * it's reachable from every authenticated screen. For mobile, where there's
 * no keyboard to press Cmd-K on, `CommandPaletteTrigger` below is a visible
 * search-icon button that calls `openCommandPalette()` — wired into the
 * BottomTabBar/Sidebar header area.
 *
 * Debounce is implemented with a `useRef`-held `setTimeout` fired from the
 * input's `onChange`, not a `useEffect` watching the query string — this
 * repo's `react-hooks/set-state-in-effect` ESLint rule (first hit in Stage
 * 4's `AddBillGlobalSheet`) flags the more obvious effect-based debounce, so
 * this follows the same established pattern.
 */
export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<SearchCustomerResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  /**
   * Guards against out-of-order fetch responses: the debounce timer alone
   * only prevents *new timers* from stacking up, but it does nothing once a
   * fetch is actually in flight. If a user types "p" (debounced fetch
   * starts), then quickly types "priya" (a second debounced fetch starts),
   * network timing is not guaranteed to resolve them in request order — the
   * slower "p" response can land *after* the faster "priya" one and
   * silently overwrite the correct results with stale ones (a real,
   * reproducible bug, not just theoretical - confirmed via a delayed-route
   * test during Stage 11 QA). Each fetch is tagged with a monotonically
   * increasing request id; a response is only applied if it's still the
   * most recently issued request by the time it resolves.
   */
  const latestRequestId = React.useRef(0)

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    function handleOpenEvent() {
      setOpen(true)
    }
    document.addEventListener("keydown", handleKeyDown)
    window.addEventListener(OPEN_EVENT, handleOpenEvent)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener(OPEN_EVENT, handleOpenEvent)
    }
  }, [])

  function handleQueryChange(value: string) {
    setQuery(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = value.trim()
    if (!trimmed) {
      // Bump the request id even on a cleared query, so a still-in-flight
      // fetch from a prior non-empty query can't land afterward and
      // repopulate results the user already cleared.
      latestRequestId.current += 1
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const requestId = ++latestRequestId.current
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        if (res.ok) {
          const data = (await res.json()) as { results: SearchCustomerResult[] }
          // Only apply this response if no newer request has been issued
          // since - otherwise this is a stale, out-of-order response.
          if (requestId === latestRequestId.current) {
            setResults(data.results)
          }
        }
      } finally {
        if (requestId === latestRequestId.current) {
          setLoading(false)
        }
      }
    }, DEBOUNCE_MS)
  }

  function handleSelect(customerId: string) {
    setOpen(false)
    setQuery("")
    setResults([])
    router.push(`/customers/${customerId}`)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setQuery("")
          setResults([])
        }
      }}
      title="Search customers"
      description="Search customers by name or mobile number"
    >
      {/* shouldFilter=false: results are already server-filtered by the /api/search
          debounced fetch, so cmdk's own client-side substring filter (which would
          run against the `value` prop, not the actual name/mobile text) is disabled. */}
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search customers by name or mobile number..."
          value={query}
          onValueChange={handleQueryChange}
        />
        <CommandList>
          {!loading && query.trim() && results.length === 0 && (
            <CommandEmpty>No customers found.</CommandEmpty>
          )}
          {results.length > 0 && (
            <CommandGroup heading="Customers">
              {results.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.id}
                  onSelect={() => handleSelect(customer.id)}
                  className="gap-3"
                >
                  <Avatar name={customer.name} size="sm" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {customer.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {customer.mobileNumber}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {customer.lastVisitDate
                      ? format(new Date(customer.lastVisitDate), "d MMM yyyy")
                      : "Never visited"}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

export interface CommandPaletteTriggerProps {
  className?: string
}

/**
 * Visible search-icon button for surfaces without a keyboard (mobile) —
 * dispatches the same custom event `CommandPalette` listens for, so no
 * shared state/context is needed between this button and the dialog it
 * opens (they can live in entirely different parts of the tree, e.g.
 * BottomTabBar vs. the root app layout).
 */
export function CommandPaletteTrigger({ className }: CommandPaletteTriggerProps) {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className={className}
      aria-label="Search customers"
    >
      <Search {...ICON_PROPS} size={18} />
    </button>
  )
}
