"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { AppleSheet } from "@/components/apple/AppleSheet"
import { AppleButton } from "@/components/apple/AppleButton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ICON_PROPS } from "@/lib/icon-map"

const MESSAGE_TYPES = [
  "BIRTHDAY",
  "ANNIVERSARY",
  "FESTIVAL",
  "NEW_ARRIVALS",
  "MONTHLY_OFFER",
  "WE_MISS_YOU",
  "CUSTOM",
] as const

const newTemplateSchema = z.object({
  type: z.enum(MESSAGE_TYPES),
  title: z.string().min(1, "Title is required"),
  body: z.string().min(1, "Body is required"),
})

type NewTemplateInput = z.infer<typeof newTemplateSchema>

/**
 * Create a brand-new `MessageTemplate` (typically `CUSTOM`, though any type
 * is allowed — `/api/templates` doesn't restrict how many templates of one
 * type can exist). `TemplateEditor` only ever PATCHes an existing template;
 * this sheet is the only client-side entry point for `POST /api/templates`.
 * New templates are created active by default (`isActive` isn't exposed
 * here — it can be toggled immediately afterward via `TemplateEditor`, same
 * as any other template).
 */
export function NewTemplateSheet() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewTemplateInput>({
    resolver: zodResolver(newTemplateSchema),
    defaultValues: { type: "CUSTOM", title: "", body: "" },
  })

  const submit = handleSubmit(async (data) => {
    setServerError(null)
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        setServerError(json.error ?? "Could not create template. Please try again.")
        return
      }
      toast.success("Template created")
      reset()
      setOpen(false)
      router.refresh()
    } catch {
      setServerError("Network error. Please try again.")
    }
  })

  return (
    <>
      <AppleButton size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Plus {...ICON_PROPS} size={16} />
        New Template
      </AppleButton>

      <AppleSheet
        open={open}
        onOpenChange={setOpen}
        title="New Message Template"
        description="Add a custom template — placeholders like {{name}} work the same as the seeded ones."
      >
        <form onSubmit={submit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-template-type">Type</Label>
            <select
              id="new-template-type"
              {...register("type")}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent"
            >
              {MESSAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-template-title">Title</Label>
            <Input id="new-template-title" placeholder="e.g. Diwali Offer" {...register("title")} />
            {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-template-body">Message Body</Label>
            <textarea
              id="new-template-body"
              rows={5}
              placeholder="Hi {{name}}, ..."
              {...register("body")}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent"
            />
            {errors.body && <p className="text-xs text-danger">{errors.body.message}</p>}
          </div>

          {serverError && <p className="text-sm text-danger">{serverError}</p>}

          <AppleButton type="submit" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? "Creating..." : "Create Template"}
          </AppleButton>
        </form>
      </AppleSheet>
    </>
  )
}
