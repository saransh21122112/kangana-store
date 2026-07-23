"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { UserPlus } from "lucide-react"
import { toast } from "sonner"

import {
  quickAddCustomerSchema,
  type QuickAddCustomerInput,
} from "@/lib/validations/customer"
import { AppleSheet } from "@/components/apple/AppleSheet"
import { AppleButton } from "@/components/apple/AppleButton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ICON_PROPS } from "@/lib/icon-map"
import type { Customer } from "@/lib/generated/prisma/client"

export interface QuickAddSheetProps {
  /** Called with the newly-created customer once the API call succeeds. */
  onCreated?: (customer: Customer) => void
  /**
   * Custom trigger element. If omitted, a default "+ Quick Add" AppleButton
   * is rendered. Either way, this component owns its own open state — no
   * external open-state control needed for the common case.
   */
  trigger?: React.ReactNode
}

/**
 * Compact "Name + Mobile Number only" version of CustomerForm, for fast
 * front-desk registration. Full details (birthday, locality, etc.) can be
 * added later via the profile's Edit Details tab.
 */
export function QuickAddSheet({ onCreated, trigger }: QuickAddSheetProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [duplicateId, setDuplicateId] = React.useState<string | null>(null)
  const [serverError, setServerError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QuickAddCustomerInput>({
    resolver: zodResolver(quickAddCustomerSchema),
    defaultValues: { name: "", mobileNumber: "" },
  })

  const submit = handleSubmit(async (data) => {
    setDuplicateId(null)
    setServerError(null)
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json();

      if (res.status === 409) {
        setDuplicateId(json.existingCustomerId ?? null)
        return
      }
      if (!res.ok) {
        setServerError(json.error ?? "Could not add customer. Please try again.")
        return
      }

      toast.success(`${data.name} added — add more details anytime.`)
      reset()
      setOpen(false)
      router.refresh()
      onCreated?.(json.customer)
    } catch {
      setServerError("Network error. Please try again.")
    }
  })

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
        <AppleButton onClick={() => setOpen(true)} variant="secondary">
          <UserPlus {...ICON_PROPS} size={18} />
          Quick Add
        </AppleButton>
      )}

      <AppleSheet
        open={open}
        onOpenChange={setOpen}
        title="Quick Add Customer"
        description="Just name and mobile number for now — you can add more details later."
      >
        <form onSubmit={submit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-name">Name</Label>
            <Input id="quick-name" placeholder="e.g. Priya Sharma" {...register("name")} />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-mobile">Mobile Number</Label>
            <Input
              id="quick-mobile"
              inputMode="numeric"
              maxLength={10}
              placeholder="9876543210"
              {...register("mobileNumber", { onChange: () => setDuplicateId(null) })}
            />
            {errors.mobileNumber && (
              <p className="text-xs text-danger">{errors.mobileNumber.message}</p>
            )}
            {duplicateId && (
              <p className="text-xs text-danger">
                A customer with this mobile number already exists.{" "}
                <a href={`/customers/${duplicateId}`} className="underline">
                  View their profile
                </a>
              </p>
            )}
          </div>

          {serverError && <p className="text-sm text-danger">{serverError}</p>}

          <AppleButton type="submit" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? "Adding..." : "Add Customer"}
          </AppleButton>
        </form>
      </AppleSheet>
    </>
  )
}
