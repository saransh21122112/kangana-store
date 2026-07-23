"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { AppleCard } from "@/components/apple/AppleCard"
import { CustomerForm } from "@/components/customers/CustomerForm"
import type { CustomerInput } from "@/lib/validations/customer"

export default function NewCustomerPage() {
  const router = useRouter()

  async function handleCreate(data: CustomerInput) {
    const res = await fetch("/api/customers", {
      method: "POST",
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

    toast.success(`${data.name} was registered successfully.`)
    router.push(`/customers/${json.customer.id}`)
    return { ok: true as const }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">New Customer</h1>
        <div className="gradient-hairline mt-2 h-0.5 w-14 rounded-full" />
        <p className="mt-2 text-sm text-muted-foreground">
          Register a new customer profile.
        </p>
      </div>

      <AppleCard>
        <CustomerForm onSubmit={handleCreate} submitLabel="Register Customer" />
      </AppleCard>
    </div>
  )
}
