"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import type { z } from "zod"

import { thresholdsSchema, type ThresholdsInput } from "@/lib/validations/settings"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AppleButton } from "@/components/apple/AppleButton"

/**
 * `thresholdsSchema` uses `z.coerce.number()`, whose zod "input" type is
 * `unknown` (not `string`) — mirroring the same `z.input`/output generic
 * split `CustomerForm` uses for its transform-based schema, so
 * `register()`'s fields stay typed against the raw form-input shape while
 * `handleSubmit`'s callback receives the coerced numeric output.
 */
type ThresholdsFormValues = z.input<typeof thresholdsSchema>

export interface ThresholdsFormProps {
  defaultValues: {
    inactiveThreshold30: number
    inactiveThreshold60: number
    inactiveThreshold90: number
  }
}

/**
 * Inactive-customer threshold tiers (Level 1/2/3, day counts). These values
 * are stored on `AppSettings` for reference/future use — the rest of the
 * app's inactive-customer lists (dashboard, WhatsApp "We Miss You" queue,
 * notifications cron) still key off fixed 30/60/90-day tiers and don't yet
 * read from this table. See MEMORY.md's Stage 9 section for the full
 * explanation of this limitation.
 */
export function ThresholdsForm({ defaultValues }: ThresholdsFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ThresholdsFormValues, unknown, ThresholdsInput>({
    resolver: zodResolver(thresholdsSchema),
    defaultValues: {
      inactiveThreshold30: defaultValues.inactiveThreshold30,
      inactiveThreshold60: defaultValues.inactiveThreshold60,
      inactiveThreshold90: defaultValues.inactiveThreshold90,
    },
  })

  const submit = handleSubmit(async (data) => {
    const res = await fetch("/api/settings/thresholds", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      toast.error("Could not save thresholds. Please try again.")
      return
    }
    toast.success("Thresholds updated.")
  })

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 max-w-md">
      <p className="text-xs text-muted-foreground">
        These are stored for reference and future use — the Lists, dashboard, and WhatsApp
        &quot;We Miss You&quot; queue still use fixed 30/60/90-day tiers and don&apos;t read
        from these values yet.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inactiveThreshold30">Inactive after (days) — Level 1</Label>
        <Input
          id="inactiveThreshold30"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          {...register("inactiveThreshold30")}
        />
        {errors.inactiveThreshold30 && (
          <p className="text-xs text-danger">{errors.inactiveThreshold30.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inactiveThreshold60">Inactive after (days) — Level 2</Label>
        <Input
          id="inactiveThreshold60"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          {...register("inactiveThreshold60")}
        />
        {errors.inactiveThreshold60 && (
          <p className="text-xs text-danger">{errors.inactiveThreshold60.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inactiveThreshold90">Inactive after (days) — Level 3</Label>
        <Input
          id="inactiveThreshold90"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          {...register("inactiveThreshold90")}
        />
        {errors.inactiveThreshold90 && (
          <p className="text-xs text-danger">{errors.inactiveThreshold90.message}</p>
        )}
      </div>

      <AppleButton type="submit" disabled={isSubmitting} className="mt-2 self-start">
        {isSubmitting ? "Saving..." : "Save Thresholds"}
      </AppleButton>
    </form>
  )
}
