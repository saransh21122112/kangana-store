import { createElement } from "react"
import { notFound } from "next/navigation"
import { Phone, MessageCircle } from "lucide-react"

import { getCustomerById, getVipCustomerIds } from "@/lib/queries/customers"
import { AppleCard } from "@/components/apple/AppleCard"
import { StatTile } from "@/components/apple/StatTile"
import { Avatar } from "@/components/apple/Avatar"
import { CustomerBadges } from "@/components/customers/CustomerBadges"
import { CustomerProfileTabs } from "@/components/customers/CustomerProfileTabs"
import { SendMessageSheet } from "@/components/messages/SendMessageSheet"
import { getCategoryIcon, ICON_PROPS } from "@/lib/icon-map"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount
  )
}

function formatDate(date: Date | string | null): string {
  if (!date) return "Never"
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function waLink(mobileNumber: string): string {
  return `https://wa.me/91${mobileNumber}`
}


interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CustomerProfilePage({ params }: PageProps) {
  const { id } = await params
  const [customer, vipIds] = await Promise.all([getCustomerById(id), getVipCustomerIds()])

  if (!customer) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <AppleCard className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={customer.name} size="lg" className="size-14 text-lg" />
            <div className="flex flex-col gap-1">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{customer.name}</h1>
              <div className="gradient-hairline h-0.5 w-12 rounded-full" />
              <div className="flex items-center gap-3">
                <a
                  href={`tel:${customer.mobileNumber}`}
                  className="flex items-center gap-1.5 text-sm text-accent hover:underline"
                >
                  <Phone {...ICON_PROPS} size={14} />
                  {customer.mobileNumber}
                </a>
                <a
                  href={waLink(customer.mobileNumber)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-success hover:underline"
                >
                  <MessageCircle {...ICON_PROPS} size={14} />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <CustomerBadges
              customerSince={customer.customerSince}
              lastVisitDate={customer.lastVisitDate}
              isVip={vipIds.has(customer.id)}
            />
            <SendMessageSheet
              customer={{
                id: customer.id,
                name: customer.name,
                loyaltyPoints: customer.loyaltyPoints,
                lastVisitDate: customer.lastVisitDate ? customer.lastVisitDate.toISOString() : null,
                favouriteCategory: customer.favouriteCategory,
              }}
            />
          </div>
        </div>

        {customer.favouriteCategory && (
          <div className="flex w-fit items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            {createElement(getCategoryIcon(customer.favouriteCategory), { ...ICON_PROPS, size: 14 })}
            Favourite: {customer.favouriteCategory}
          </div>
        )}
      </AppleCard>

      {/* Rollup stats below reflect whatever is currently stored on the
          Customer row — nothing keeps these live yet, that's Stage 4. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <AppleCard>
          <StatTile label="Customer Since" value={formatDate(customer.customerSince)} />
        </AppleCard>
        <AppleCard>
          <StatTile label="Total Purchase" value={formatCurrency(customer.totalPurchaseAmount)} />
        </AppleCard>
        <AppleCard>
          <StatTile label="Total Visits" value={customer.totalVisits} />
        </AppleCard>
        <AppleCard>
          <StatTile label="Avg Bill Value" value={formatCurrency(customer.averageBillValue)} />
        </AppleCard>
        <AppleCard>
          <StatTile label="Last Visit" value={formatDate(customer.lastVisitDate)} />
        </AppleCard>
        <AppleCard>
          <StatTile label="Loyalty Points" value={customer.loyaltyPoints} />
        </AppleCard>
      </div>

      <CustomerProfileTabs customer={customer} bills={customer.bills} messages={customer.messagesLog} />
    </div>
  )
}
