"use client"

import * as React from "react"
import { HeartHandshake } from "lucide-react"

import { AppleCard } from "@/components/apple/AppleCard"
import { AppleButton } from "@/components/apple/AppleButton"
import { EmptyState } from "@/components/apple/EmptyState"
import { Avatar } from "@/components/apple/Avatar"
import { SendQueueList } from "@/components/messages/SendQueueList"

export interface WeMissYouCandidate {
  id: string
  name: string
  daysSinceLastVisit: number | null
}

export interface WeMissYouPanelProps {
  candidates: WeMissYouCandidate[]
  /** id of the WE_MISS_YOU MessageTemplate, or null if none exists yet. */
  templateId: string | null
}

/**
 * Owner-approval queue for the We-Miss-You campaign: lists customers past
 * 30 days inactive with the WE_MISS_YOU template pre-selected, but never
 * sends anything on its own — the owner reviews the list (can deselect
 * individuals), then explicitly starts the same click-through
 * `SendQueueList` every other bulk campaign uses. No silent/automatic
 * sends, per the brief's explicit intent for a beauty/jewellery brand's
 * tone.
 */
export function WeMissYouPanel({ candidates, templateId }: WeMissYouPanelProps) {
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(candidates.map((c) => c.id)))
  const [sending, setSending] = React.useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!templateId) {
    return (
      <AppleCard glow>
        <EmptyState
          icon={HeartHandshake}
          title="No We Miss You template"
          description="Create a WE_MISS_YOU message template first."
        />
      </AppleCard>
    )
  }

  if (candidates.length === 0) {
    return (
      <AppleCard glow>
        <EmptyState
          icon={HeartHandshake}
          title="No inactive customers right now"
          description="Nobody has crossed the 30-day inactivity mark. Nice work!"
        />
      </AppleCard>
    )
  }

  if (sending) {
    return (
      <SendQueueList
        customerIds={Array.from(selected)}
        templateId={templateId}
        onDone={() => setSending(false)}
      />
    )
  }

  return (
    <AppleCard glow className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">We Miss You — Owner Review</h2>
          <p className="text-sm text-muted-foreground">
            {candidates.length} customers past 30 days inactive · {selected.size} selected
          </p>
        </div>
        <AppleButton size="sm" disabled={selected.size === 0} onClick={() => setSending(true)}>
          Send to {selected.size}
        </AppleButton>
      </div>

      <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
        {candidates.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50">
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
                className="size-4 rounded border-border accent-accent"
              />
              <Avatar name={c.name} size="sm" />
              <span className="flex-1 text-sm font-medium text-foreground">{c.name}</span>
              <span className="text-xs text-muted-foreground">
                {c.daysSinceLastVisit === null ? "Never visited" : `${c.daysSinceLastVisit} days ago`}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </AppleCard>
  )
}
