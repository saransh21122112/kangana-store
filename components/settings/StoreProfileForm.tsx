"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import type { z } from "zod"

import { storeProfileSchema, type StoreProfileInput } from "@/lib/validations/settings"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AppleButton } from "@/components/apple/AppleButton"

export interface StoreProfileFormProps {
  defaultValues: {
    storeName: string
    logoUrl: string | null
    accentColor: string
  }
}

/**
 * `storeProfileSchema`'s `logoUrl` field is a `.transform()` (empty string
 * or `undefined` in, `string | null` out), so its zod "input" type (what
 * `register()`'s raw form field actually holds) and "output" type
 * (`StoreProfileInput`, post-transform, what `onSubmit` receives) differ —
 * same `z.input`/output 3-generic `useForm` split `CustomerForm` and
 * `ThresholdsForm` already use for their own transform-based schemas.
 */
type StoreProfileFormValues = z.input<typeof storeProfileSchema>

/**
 * Store name / logo URL / accent color. There's no live theme-swap wired to
 * `accentColor` yet (Stage 1's `--accent` CSS variable is static) — this
 * form persists the value for future use, matching the original spec's
 * intent ("so the salon owner can later pick gold/rose"), without also
 * building a runtime theme-injection system that wasn't asked for here.
 */
export function StoreProfileForm({ defaultValues }: StoreProfileFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StoreProfileFormValues, unknown, StoreProfileInput>({
    resolver: zodResolver(storeProfileSchema),
    defaultValues: {
      storeName: defaultValues.storeName,
      logoUrl: defaultValues.logoUrl ?? "",
      accentColor: defaultValues.accentColor,
    },
  })

  const submit = handleSubmit(async (data) => {
    const res = await fetch("/api/settings/store", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      toast.error("Could not save store profile. Please try again.")
      return
    }
    toast.success("Store profile updated.")
  })

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 max-w-md">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="storeName">Store Name</Label>
        <Input id="storeName" placeholder="Kangna Beauty & Jewellery" {...register("storeName")} />
        {errors.storeName && <p className="text-xs text-danger">{errors.storeName.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="logoUrl">Logo URL</Label>
        <Input id="logoUrl" placeholder="https://..." {...register("logoUrl")} />
        {errors.logoUrl && <p className="text-xs text-danger">{errors.logoUrl.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="accentColor">Accent Color</Label>
        <Input id="accentColor" placeholder="#0A84FF" className="max-w-[140px]" {...register("accentColor")} />
        {errors.accentColor && <p className="text-xs text-danger">{errors.accentColor.message}</p>}
      </div>

      <AppleButton type="submit" disabled={isSubmitting} className="mt-2 self-start">
        {isSubmitting ? "Saving..." : "Save Store Profile"}
      </AppleButton>
    </form>
  )
}
