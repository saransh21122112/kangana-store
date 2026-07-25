"use client"

import * as React from "react"
import { Users, Megaphone } from "lucide-react"

import { AppleCard } from "@/components/apple/AppleCard"
import { AppleButton } from "@/components/apple/AppleButton"
import { SegmentedControl } from "@/components/apple/SegmentedControl"
import { EmptyState } from "@/components/apple/EmptyState"
import { SendQueueList } from "@/components/messages/SendQueueList"

export interface CampaignCustomer {
  id: string
  name: string
  mobileNumber: string
}

export interface CampaignTemplateOption {
  id: string
  title: string
  type: string
}

export interface AudienceOption {
  key: string
  label: string
  customers: CampaignCustomer[]
}

export interface CampaignBuilderProps {
  templates: CampaignTemplateOption[]
  /** Quick-pick audiences, e.g. Inactive 30+, Top Spenders, Birthdays This Week. */
  audiences: AudienceOption[]
  /** Full customer list for manual multi-select. */
  allCustomers: CampaignCustomer[]
}

/**
 * Bulk campaign builder: pick a template, pick an audience (a Stage-5
 * quick-pick list, or a manual multi-select search over all customers),
 * see the recipient count, then hand off to `SendQueueList` for the
 * actual click-through send.
 */
export function CampaignBuilder({ templates, audiences, allCustomers }: CampaignBuilderProps) {
  const [templateId, setTemplateId] = React.useState(templates[0]?.id ?? "")
  const [audienceKey, setAudienceKey] = React.useState<string>(audiences[0]?.key ?? "manual")
  const [manualSelected, setManualSelected] = React.useState<Set<string>>(new Set())
  const [search, setSearch] = React.useState("")
  const [sending, setSending] = React.useState(false)

  const audienceOptions = [...audiences, { key: "manual", label: "Manual Select", customers: [] }]

  const recipients: CampaignCustomer[] =
    audienceKey === "manual"
      ? allCustomers.filter((c) => manualSelected.has(c.id))
      : (audiences.find((a) => a.key === audienceKey)?.customers ?? [])

  const filteredForManualPick = allCustomers.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.mobileNumber.includes(search)
  )

  function toggleManual(id: string) {
    setManualSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (sending) {
    return (
      <SendQueueList
        customerIds={recipients.map((c) => c.id)}
        templateId={templateId}
        onDone={() => setSending(false)}
      />
    )
  }

  if (templates.length === 0) {
    return (
      <AppleCard>
        <EmptyState
          icon={Megaphone}
          title="No message templates"
          description="Create a template under Message Templates first."
        />
      </AppleCard>
    )
  }

  return (
    <AppleCard className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">1. Choose a template</span>
        <select
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
        <span className="text-sm font-medium text-foreground">2. Choose an audience</span>
        <SegmentedControl
          options={audienceOptions.map((a) => ({ value: a.key, label: a.label }))}
          value={audienceKey}
          onChange={setAudienceKey}
        />
      </div>

      {audienceKey === "manual" && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Search customers by name or mobile…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent"
          />
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-xl border border-border p-1">
            {filteredForManualPick.length === 0 ? (
              <li className="px-2 py-4 text-center text-sm text-muted-foreground">No customers found.</li>
            ) : (
              filteredForManualPick.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={manualSelected.has(c.id)}
                      onChange={() => toggleManual(c.id)}
                      className="size-4 rounded border-border accent-accent"
                    />
                    <span className="flex-1 text-sm text-foreground">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.mobileNumber}</span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Users size={16} strokeWidth={1.75} />
          <span>
            <strong>{recipients.length}</strong> recipient{recipients.length === 1 ? "" : "s"} selected
          </span>
        </div>
        <AppleButton
          size="sm"
          disabled={recipients.length === 0 || !templateId}
          onClick={() => setSending(true)}
        >
          Start Send Queue
        </AppleButton>
      </div>
    </AppleCard>
  )
}
