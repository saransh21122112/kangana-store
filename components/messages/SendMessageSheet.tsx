"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MessageCircle } from "lucide-react"

import { AppleSheet } from "@/components/apple/AppleSheet"
import { AppleButton } from "@/components/apple/AppleButton"
import { Label } from "@/components/ui/label"

export interface SendMessageCustomer {
  id: string
  name: string
  loyaltyPoints: number
  lastVisitDate: string | null
  favouriteCategory: string | null
}

interface TemplateOption {
  id: string
  title: string
  type: string
  body: string
  isActive: boolean
}

/**
 * Client-side mirror of `lib/queries/message-templates.ts`'s
 * `renderTemplate` — duplicated (not imported) because that file imports
 * `lib/prisma.ts` at module scope, which would pull the Prisma client into
 * this client component's bundle. Same placeholder set/fallbacks as the
 * server version.
 */
function renderTemplateClient(body: string, customer: SendMessageCustomer): string {
  const values: Record<string, string> = {
    name: customer.name || "Valued Customer",
    loyaltyPoints: String(customer.loyaltyPoints ?? 0),
    lastVisitDate: customer.lastVisitDate
      ? new Date(customer.lastVisitDate).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "your last visit",
    favouriteCategory: customer.favouriteCategory || "our collection",
  }
  return body.replace(/\{\{(\w+)\}\}/g, (match, token: string) => (token in values ? values[token] : match))
}

export interface SendMessageSheetProps {
  customer: SendMessageCustomer
}

/**
 * One-click send from a customer's profile: pick a template type, see the
 * live-rendered preview for this specific customer, then "Send via
 * WhatsApp" — calls `/api/messages/send`, opens the returned wa.me link in
 * a new tab (still a direct result of this click, so the popup isn't
 * blocked), toasts, and refreshes the page so the "Messages Sent" tab
 * picks up the new log row.
 */
export function SendMessageSheet({ customer }: SendMessageSheetProps) {
  const [open, setOpen] = React.useState(false)
  const [templates, setTemplates] = React.useState<TemplateOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [templateId, setTemplateId] = React.useState<string>("")
  const [sending, setSending] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    if (!open || templates.length > 0) return
    let cancelled = false

    async function loadTemplates() {
      setLoading(true)
      try {
        const res = await fetch("/api/templates")
        const json = await res.json()
        if (cancelled) return
        const active: TemplateOption[] = (json.templates ?? []).filter((t: TemplateOption) => t.isActive)
        setTemplates(active)
        setTemplateId(active[0]?.id ?? "")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadTemplates()
    return () => {
      cancelled = true
    }
  }, [open, templates.length])

  const selectedTemplate = templates.find((t) => t.id === templateId)
  const preview = selectedTemplate ? renderTemplateClient(selectedTemplate.body, customer) : ""

  async function handleSend() {
    if (!templateId) return
    setSending(true)
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer.id, templateId }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Failed to send message")
        return
      }
      window.open(json.waLink, "_blank", "noopener,noreferrer")
      toast.success("Message logged — WhatsApp opened in a new tab")
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <AppleButton size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <MessageCircle size={14} strokeWidth={1.75} />
        Send Message
      </AppleButton>

      <AppleSheet
        open={open}
        onOpenChange={setOpen}
        title="Send WhatsApp Message"
        description={`Choose a template to send to ${customer.name}.`}
      >
        <div className="flex flex-col gap-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading templates…</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active templates available.</p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template-select">Template</Label>
                <select
                  id="template-select"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Preview</Label>
                <div className="min-h-[5rem] rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap text-foreground">
                  {preview}
                </div>
              </div>

              <AppleButton onClick={handleSend} disabled={sending} className="w-full">
                {sending ? "Sending…" : "Send via WhatsApp"}
              </AppleButton>
            </>
          )}
        </div>
      </AppleSheet>
    </>
  )
}
