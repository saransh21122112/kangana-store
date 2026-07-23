"use client"

import * as React from "react"
import { toast } from "sonner"

import { AppleCard } from "@/components/apple/AppleCard"
import { AppleButton } from "@/components/apple/AppleButton"
import { AppleBadge } from "@/components/apple/Badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { MessageTemplate } from "@/lib/generated/prisma/client"

export interface TemplateEditorProps {
  template: MessageTemplate
}

/**
 * Sample customer used purely to drive the live preview as the owner
 * types — matches the brief's exact example values.
 */
const SAMPLE_CUSTOMER = {
  name: "Priya Sharma",
  loyaltyPoints: 120,
  lastVisitDate: new Date(),
  favouriteCategory: "Jewellery",
}

function renderPreview(body: string): string {
  const values: Record<string, string> = {
    name: SAMPLE_CUSTOMER.name,
    loyaltyPoints: String(SAMPLE_CUSTOMER.loyaltyPoints),
    lastVisitDate: SAMPLE_CUSTOMER.lastVisitDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    favouriteCategory: SAMPLE_CUSTOMER.favouriteCategory,
  }
  return body.replace(/\{\{(\w+)\}\}/g, (match, token: string) => (token in values ? values[token] : match))
}

/**
 * Form + live preview for a single MessageTemplate — title, body textarea,
 * isActive toggle, and a preview panel that re-renders on every keystroke
 * using sample customer data (client-side mirror of
 * `lib/queries/message-templates.ts`'s `renderTemplate`, kept intentionally
 * simple/duplicated rather than shared, since this preview never touches
 * the DB and doesn't need the full Customer shape).
 */
export function TemplateEditor({ template }: TemplateEditorProps) {
  const [title, setTitle] = React.useState(template.title)
  const [body, setBody] = React.useState(template.body)
  const [isActive, setIsActive] = React.useState(template.isActive)
  const [saving, setSaving] = React.useState(false)

  const preview = renderPreview(body)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, isActive }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error ?? "Failed to save template")
        return
      }
      toast.success("Template saved")
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppleCard className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <AppleBadge variant="neutral">{template.type}</AppleBadge>
        <button
          type="button"
          onClick={() => setIsActive((v) => !v)}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
        >
          <span
            className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
              isActive ? "bg-success justify-end" : "bg-muted justify-start"
            }`}
          >
            <span className="size-4 rounded-full bg-white shadow" />
          </span>
          {isActive ? "Active" : "Inactive"}
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`title-${template.id}`}>Title</Label>
        <Input id={`title-${template.id}`} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`body-${template.id}`}>Message Body</Label>
          <textarea
            id={`body-${template.id}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="text-xs text-muted-foreground">
            Placeholders: <code>{"{{name}}"}</code> <code>{"{{loyaltyPoints}}"}</code>{" "}
            <code>{"{{lastVisitDate}}"}</code> <code>{"{{favouriteCategory}}"}</code>
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Live Preview</Label>
          <div className="min-h-[7.5rem] rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap text-foreground">
            {preview || <span className="text-muted-foreground">Nothing to preview yet.</span>}
          </div>
          <p className="text-xs text-muted-foreground">
            Sample customer: Priya Sharma · 120 pts · Jewellery
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <AppleButton size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </AppleButton>
      </div>
    </AppleCard>
  )
}
