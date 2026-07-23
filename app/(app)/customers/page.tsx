import Link from "next/link"
import { Phone, MessageCircle, UserPlus, Users } from "lucide-react"

import { getAllCustomers, getVipCustomerIds, type VisitFrequencyBucket } from "@/lib/queries/customers"
import { AppleCard } from "@/components/apple/AppleCard"
import { AppleButton } from "@/components/apple/AppleButton"
import { Avatar } from "@/components/apple/Avatar"
import { EmptyState } from "@/components/apple/EmptyState"
import { StaggerList, StaggerItem } from "@/components/apple/motion"
import { CustomerBadges } from "@/components/customers/CustomerBadges"
import { QuickAddSheet } from "@/components/customers/QuickAddSheet"
import { CustomerFilterBar } from "@/components/customers/CustomerFilterBar"
import { AddBillGlobalSheet } from "@/components/bills/AddBillGlobalSheet"
import { ICON_PROPS } from "@/lib/icon-map"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount
  )
}

function waLink(mobileNumber: string): string {
  return `https://wa.me/91${mobileNumber}`
}

interface CustomersPageProps {
  // Next.js server components read search params via the `searchParams`
  // prop (async in this Next version), not the client-only
  // `useSearchParams` hook — the filter UI itself (`CustomerFilterBar`) is a
  // client sub-component that pushes URL params, and this server component
  // re-renders on navigation and reads them here. Same split Stage 5's
  // `/lists` page + `ListsSegmentedNav` established.
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams

  const category = firstValue(params.category)
  const visitFrequency = firstValue(params.visitFrequency) as VisitFrequencyBucket | undefined
  const minSpendRaw = firstValue(params.minSpend)
  const maxSpendRaw = firstValue(params.maxSpend)
  const lastVisitFromRaw = firstValue(params.lastVisitFrom)
  const lastVisitToRaw = firstValue(params.lastVisitTo)

  const [customers, vipIds] = await Promise.all([
    getAllCustomers({
      category,
      visitFrequency,
      minSpend: minSpendRaw ? Number(minSpendRaw) : undefined,
      maxSpend: maxSpendRaw ? Number(maxSpendRaw) : undefined,
      lastVisitFrom: lastVisitFromRaw ? new Date(lastVisitFromRaw) : undefined,
      // Inclusive of the whole "to" day — the raw <input type="date"> value
      // parses to that day's midnight UTC, which would otherwise exclude
      // any lastVisitDate later that same day.
      lastVisitTo: lastVisitToRaw ? new Date(`${lastVisitToRaw}T23:59:59.999Z`) : undefined,
    }),
    getVipCustomerIds(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Customers</h1>
          <div className="gradient-hairline mt-2 h-0.5 w-14 rounded-full" />
          <p className="mt-2 text-sm text-muted-foreground">
            {customers.length} customer{customers.length === 1 ? "" : "s"} matching.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CustomerFilterBar />
          <AddBillGlobalSheet />
          <QuickAddSheet />
          <Link href="/customers/new">
            <AppleButton>
              <UserPlus {...ICON_PROPS} size={18} />
              New Customer
            </AppleButton>
          </Link>
        </div>
      </div>

      {customers.length === 0 ? (
        <AppleCard>
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Register your first customer to start building their profile and purchase history."
          />
        </AppleCard>
      ) : (
        <StaggerList className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {customers.map((customer) => (
            <StaggerItem key={customer.id}>
              <AppleCard className="flex flex-col gap-3 transition-shadow hover:shadow-lg">
                {/* Not nested inside the tel:/wa.me anchors below (invalid HTML) —
                    this Link covers just the identity/stats section. */}
                <Link href={`/customers/${customer.id}`} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={customer.name} size="lg" />
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{customer.name}</span>
                        <span className="text-xs text-muted-foreground">{customer.mobileNumber}</span>
                      </div>
                    </div>
                  </div>

                  <CustomerBadges
                    customerSince={customer.customerSince}
                    lastVisitDate={customer.lastVisitDate}
                    isVip={vipIds.has(customer.id)}
                  />

                  <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                    <span className="text-muted-foreground">Total Spend</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(customer.totalPurchaseAmount)}
                    </span>
                  </div>
                </Link>

                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${customer.mobileNumber}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <Phone {...ICON_PROPS} size={14} />
                    Call
                  </a>
                  <a
                    href={waLink(customer.mobileNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <MessageCircle {...ICON_PROPS} size={14} />
                    WhatsApp
                  </a>
                </div>
              </AppleCard>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  )
}
