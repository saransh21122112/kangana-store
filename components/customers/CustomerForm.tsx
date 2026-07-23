"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import type { z } from "zod"

import { customerSchema, type CustomerInput } from "@/lib/validations/customer"

/**
 * `customerSchema` transforms date strings into `Date`s, so its zod
 * "input" type (raw form values, e.g. birthday as a "YYYY-MM-DD" string
 * from <input type="date">) differs from its "output" type (`CustomerInput`,
 * post-transform). `useForm`'s 3-generic signature lets the form fields use
 * the input shape while `handleSubmit`'s callback receives the transformed
 * output shape — no manual re-parsing needed.
 */
type CustomerFormValues = z.input<typeof customerSchema>
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AppleButton } from "@/components/apple/AppleButton"
import { SegmentedControl } from "@/components/apple/SegmentedControl"
import { cn } from "@/lib/utils"

export interface CustomerFormDefaultValues {
  name?: string
  mobileNumber?: string
  birthday?: string | null
  anniversary?: string | null
  areaLocality?: string | null
  gender?: "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED" | null
}

export interface DuplicateMobileError {
  existingCustomerId: string
}

export interface CustomerFormProps {
  defaultValues?: CustomerFormDefaultValues
  onSubmit: (data: CustomerInput) => Promise<{ ok: true } | { ok: false; duplicate?: DuplicateMobileError; message?: string }>
  submitLabel?: string
  /** Called after a successful submit (e.g. redirect, close sheet, toast). */
  onSuccess?: () => void
}

const genderOptions = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "OTHER", label: "Other" },
]

/** Converts a Date/ISO string to the "YYYY-MM-DD" shape <input type="date"> expects. */
function toDateInputValue(value?: string | null): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

/**
 * Full customer registration/edit form. Reusable for both create (no
 * defaultValues) and edit (defaultValues + a PATCH-backed onSubmit) flows —
 * the caller owns what onSubmit actually does with the validated data.
 */
export function CustomerForm({ defaultValues, onSubmit, submitLabel = "Save Customer", onSuccess }: CustomerFormProps) {
  const [duplicate, setDuplicate] = React.useState<DuplicateMobileError | null>(null)
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [gender, setGender] = React.useState<string>(defaultValues?.gender ?? "FEMALE")

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues, unknown, CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      mobileNumber: defaultValues?.mobileNumber ?? "",
      birthday: toDateInputValue(defaultValues?.birthday),
      anniversary: toDateInputValue(defaultValues?.anniversary),
      areaLocality: defaultValues?.areaLocality ?? "",
      gender: defaultValues?.gender ?? "FEMALE",
    },
  })

  const submit = handleSubmit(async (data) => {
    setDuplicate(null)
    setServerError(null)
    const result = await onSubmit({ ...data, gender: gender as CustomerInput["gender"] })
    if (!result.ok) {
      if (result.duplicate) {
        setDuplicate(result.duplicate)
      } else {
        setServerError(result.message ?? "Something went wrong. Please try again.")
      }
      return
    }
    onSuccess?.()
  })

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" placeholder="e.g. Priya Sharma" {...register("name")} />
        {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mobileNumber">Mobile Number</Label>
        <Input
          id="mobileNumber"
          inputMode="numeric"
          maxLength={10}
          placeholder="9876543210"
          {...register("mobileNumber")}
          onChange={(e) => {
            setDuplicate(null)
            register("mobileNumber").onChange(e)
          }}
        />
        {errors.mobileNumber && (
          <p className="text-xs text-danger">{errors.mobileNumber.message}</p>
        )}
        {duplicate && (
          <p className="text-xs text-danger">
            A customer with this mobile number already exists.{" "}
            <Link href={`/customers/${duplicate.existingCustomerId}`} className="underline">
              View their profile
            </Link>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="birthday">Birthday</Label>
          <Input id="birthday" type="date" {...register("birthday")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="anniversary">Anniversary</Label>
          <Input id="anniversary" type="date" {...register("anniversary")} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="areaLocality">Area / Locality</Label>
        <Input id="areaLocality" placeholder="e.g. Andheri West" {...register("areaLocality")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Gender</Label>
        <SegmentedControl options={genderOptions} value={gender} onChange={setGender} />
      </div>

      {serverError && <p className="text-sm text-danger">{serverError}</p>}

      <AppleButton type="submit" disabled={isSubmitting} className={cn("mt-2")}>
        {isSubmitting ? "Saving..." : submitLabel}
      </AppleButton>
    </form>
  )
}
