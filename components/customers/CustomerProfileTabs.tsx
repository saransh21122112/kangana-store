"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { MessageCircle } from "lucide-react"
import { toast } from "sonner"

import { SegmentedControl } from "@/components/apple/SegmentedControl"
import { AppleCard } from "@/components/apple/AppleCard"
import { EmptyState } from "@/components/apple/EmptyState"
import { CustomerForm, type CustomerFormDefaultValues } from "@/components/customers/CustomerForm"
import { BillHistoryTable } from "@/components/bills/BillHistoryTable"
import type { Bill, Customer, MessageLog } from "@/lib/generated/prisma/client"
import type { CustomerInput } from "@/lib/validations/customer"

export interface CustomerProfileTabsProps {
  customer: Customer
  bills: Bill[]
  messages: MessageLog[]
}

const TABS = [
  { value: "visits", label: "Visit History" },
  { value: "messages", label: "Messages Sent" },
  { value: "edit", label: "Edit Details" },
]

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/**
 * Three-tab customer profile body: Visit History (bills, read-only — bill
 * *creation* is Stage 4's job), Messages Sent (MessageLog, read-only —
 * Stage 6 builds actual sending), Edit Details (CustomerForm wired to the
 * PATCH endpoint).
 */
export function CustomerProfileTabs({ customer, bills, messages }: CustomerProfileTabsProps) {
  const [tab, setTab] = React.useState("visits")
  const router = useRouter()

  const defaultValues: CustomerFormDefaultValues = {
    name: customer.name,
    mobileNumber: customer.mobileNumber,
    birthday: customer.birthday ? customer.birthday.toISOString() : null,
    anniversary: customer.anniversary ? customer.anniversary.toISOString() : null,
    areaLocality: customer.areaLocality,
    gender: customer.gender,
  }

  async function handleUpdate(data: CustomerInput) {
    const res = await fetch(`/api/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const json = await res.json()

    if (res.status === 409) {
      return { ok: false as const, duplicate: { existingCustomerId: json.existingCustomerId as string } }
    }
    if (!res.ok) {
      return { ok: false as const, message: json.error as string | undefined }
    }
    return { ok: true as const }
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl options={TABS} value={tab} onChange={setTab} />

      {tab === "visits" && <BillHistoryTable customerId={customer.id} bills={bills} />}

      {tab === "messages" && (
        <AppleCard noPadding className="overflow-hidden">
          {messages.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="No messages sent yet"
              description="Birthday, anniversary, and campaign messages sent to this customer will appear here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {messages.map((msg) => (
                <li key={msg.id} className="flex flex-col gap-1 px-5 py-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{msg.type}</span>
                    <span className="text-xs text-muted-foreground">
                      {msg.sentAt ? formatDate(msg.sentAt) : formatDate(msg.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{msg.bodySent}</p>
                  <span className="text-xs text-muted-foreground">{msg.status}</span>
                </li>
              ))}
            </ul>
          )}
        </AppleCard>
      )}

      {tab === "edit" && (
        <AppleCard>
          <CustomerForm
            defaultValues={defaultValues}
            submitLabel="Save Changes"
            onSubmit={handleUpdate}
            onSuccess={() => {
              toast.success("Customer details updated.")
              router.refresh()
            }}
          />
        </AppleCard>
      )}
    </div>
  )
}
