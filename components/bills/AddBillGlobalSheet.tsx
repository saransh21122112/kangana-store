"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Receipt, Search, UserPlus, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import { AppleSheet } from "@/components/apple/AppleSheet"
import { AppleButton } from "@/components/apple/AppleButton"
import { Avatar } from "@/components/apple/Avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AddBillForm } from "@/components/bills/AddBillForm"
import {
  quickAddCustomerSchema,
  type QuickAddCustomerInput,
} from "@/lib/validations/customer"
import { ICON_PROPS } from "@/lib/icon-map"
import type { Customer } from "@/lib/generated/prisma/client"

export interface AddBillGlobalSheetProps {
  /** Custom trigger element. Falls back to a default "+ Add Bill" AppleButton
   * if omitted — mirrors QuickAddSheet's own trigger API for consistency. */
  trigger?: React.ReactNode
  /** STAFF can't see phone numbers — hides the mobile-number line from
   * each search result (they still select by name). */
  hidePhone?: boolean
}

type Step = "search" | "quickAdd" | "form"

/**
 * Self-contained global "+ Add Bill" entry point, usable from anywhere
 * (Sidebar, customers page, etc). Owns its own open state, same pattern as
 * Stage 3's QuickAddSheet. Flow: search-as-you-type for an existing
 * customer (name or mobile) → pick one, or fall back to a compact
 * inline "create new customer" form if not found → AddBillForm scoped to
 * whichever customer was selected/created.
 */
export function AddBillGlobalSheet({ trigger, hidePhone }: AddBillGlobalSheetProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<Step>("search")
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<Customer[]>([])
  const [searching, setSearching] = React.useState(false)
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null)

  // Search-as-you-type, debounced via a ref-held timer rather than an
  // effect watching `query` — triggering the fetch straight from the
  // input's onChange (see handleQueryChange below) avoids the
  // react-hooks/set-state-in-effect lint (calling setState synchronously
  // inside an effect body) that a `useEffect(() => {...}, [query])`
  // version of this would trip.
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const q = value.trim()
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    debounceRef.current = setTimeout(() => {
      fetch(`/api/customers?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((json) => setResults(json.customers ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 300)
  }

  function reset() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setStep("search")
    setQuery("")
    setResults([])
    setSelectedCustomer(null)
    setSearching(false)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) reset()
  }

  function selectCustomer(customer: Customer) {
    setSelectedCustomer(customer)
    setStep("form")
  }

  return (
    <>
      {trigger ? (
        React.isValidElement(trigger) ? (
          React.cloneElement(
            trigger as React.ReactElement<{ onClick?: () => void }>,
            { onClick: () => setOpen(true) }
          )
        ) : (
          trigger
        )
      ) : (
        <AppleButton onClick={() => setOpen(true)}>
          <Receipt {...ICON_PROPS} size={18} />
          Add Bill
        </AppleButton>
      )}

      <AppleSheet
        open={open}
        onOpenChange={handleOpenChange}
        title={
          step === "search"
            ? "Add Bill — Find Customer"
            : step === "quickAdd"
              ? "Add Bill — New Customer"
              : `Add Bill — ${selectedCustomer?.name ?? ""}`
        }
        description={
          step === "search"
            ? "Search by name or mobile number."
            : step === "quickAdd"
              ? "Customer not found — create one, then add their bill."
              : undefined
        }
      >
        {step === "search" && (
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bill-customer-search">Customer</Label>
              <div className="relative">
                <Search
                  {...ICON_PROPS}
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="bill-customer-search"
                  placeholder="Search by name or mobile number..."
                  className="pl-9"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {searching && <p className="text-sm text-muted-foreground">Searching...</p>}

            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-6 text-center">
                <p className="text-sm text-muted-foreground">No customer found for &ldquo;{query}&rdquo;.</p>
                <AppleButton variant="secondary" onClick={() => setStep("quickAdd")}>
                  <UserPlus {...ICON_PROPS} size={16} />
                  Create New Customer
                </AppleButton>
              </div>
            )}

            {results.length > 0 && (
              <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
                {results.map((customer) => (
                  <li key={customer.id}>
                    <button
                      type="button"
                      onClick={() => selectCustomer(customer)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted"
                    >
                      <Avatar name={customer.name} />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{customer.name}</span>
                        {!hidePhone && (
                          <span className="text-xs text-muted-foreground">{customer.mobileNumber}</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === "quickAdd" && (
          <QuickAddInline
            initialName={query.length >= 2 && !/^\d+$/.test(query) ? query : ""}
            initialMobile={/^\d+$/.test(query) ? query : ""}
            onBack={() => setStep("search")}
            onCreated={(customer) => selectCustomer(customer)}
          />
        )}

        {step === "form" && selectedCustomer && (
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep("search")}
              className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft {...ICON_PROPS} size={14} />
              Choose a different customer
            </button>
            <AddBillForm
              customerId={selectedCustomer.id}
              onSuccess={() => {
                toast.success(`Bill added for ${selectedCustomer.name}.`)
                setOpen(false)
                reset()
                router.refresh()
              }}
            />
          </div>
        )}
      </AppleSheet>
    </>
  )
}

interface QuickAddInlineProps {
  initialName: string
  initialMobile: string
  onBack: () => void
  onCreated: (customer: Customer) => void
}

/**
 * Compact inline "create a new customer" mini-form, used as the fallback
 * step inside AddBillGlobalSheet when a search turns up nothing — mirrors
 * QuickAddSheet's Name+Mobile-only fields but renders inline (no nested
 * AppleSheet-in-AppleSheet) since it's already inside one.
 */
function QuickAddInline({ initialName, initialMobile, onBack, onCreated }: QuickAddInlineProps) {
  const [name, setName] = React.useState(initialName)
  const [mobileNumber, setMobileNumber] = React.useState(initialMobile)
  const [duplicateId, setDuplicateId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setDuplicateId(null)
    setError(null)

    const parsed = quickAddCustomerSchema.safeParse({ name, mobileNumber })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the fields above.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data satisfies QuickAddCustomerInput),
      })
      const json = await res.json()

      if (res.status === 409) {
        setDuplicateId(json.existingCustomerId ?? null)
        return
      }
      if (!res.ok) {
        setError(json.error ?? "Could not add customer. Please try again.")
        return
      }

      onCreated(json.customer)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pt-2">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft {...ICON_PROPS} size={14} />
        Back to search
      </button>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quick-bill-name">Name</Label>
        <Input
          id="quick-bill-name"
          placeholder="e.g. Priya Sharma"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quick-bill-mobile">Mobile Number</Label>
        <Input
          id="quick-bill-mobile"
          inputMode="numeric"
          maxLength={10}
          placeholder="9876543210"
          value={mobileNumber}
          onChange={(e) => {
            setMobileNumber(e.target.value)
            setDuplicateId(null)
          }}
        />
        {duplicateId && (
          <p className="text-xs text-danger">
            A customer with this mobile number already exists.{" "}
            <a href={`/customers/${duplicateId}`} className="underline">
              View their profile
            </a>
          </p>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <AppleButton type="submit" disabled={submitting} className="mt-2">
        {submitting ? "Creating..." : "Create Customer & Continue"}
      </AppleButton>
    </form>
  )
}
