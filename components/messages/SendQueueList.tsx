"use client"

import * as React from "react"
import { toast } from "sonner"
import { MessageCircle, CheckCircle2 } from "lucide-react"

import { AppleCard } from "@/components/apple/AppleCard"
import { AppleButton } from "@/components/apple/AppleButton"
import { ICON_PROPS } from "@/lib/icon-map"
import type { BulkSendResultEntry } from "@/app/api/messages/bulk-send/route"

export interface SendQueueListProps {
  /** Customer ids to send to. */
  customerIds: string[]
  templateId: string
  onDone?: () => void
}

type QueueState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; entries: BulkSendResultEntry[]; index: number; sentCount: number }
  | { status: "error"; message: string }

/**
 * Send-queue UI: calls `/api/messages/bulk-send` once (which pre-renders
 * every recipient's message and writes their MessageLog rows), then walks
 * the returned links one at a time — "Send & Next" is a direct click
 * handler that opens the current recipient's wa.me link via
 * `window.open`, since browsers block programmatic multi-window opens not
 * tied to a user gesture. There is no automatic/silent sending.
 */
export function SendQueueList({ customerIds, templateId, onDone }: SendQueueListProps) {
  const [state, setState] = React.useState<QueueState>({ status: "idle" })

  React.useEffect(() => {
    let cancelled = false

    async function start() {
      setState({ status: "loading" })
      try {
        const res = await fetch("/api/messages/bulk-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerIds, templateId }),
        })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setState({ status: "error", message: json.error ?? "Failed to start send queue" })
          return
        }
        setState({ status: "ready", entries: json.results, index: 0, sentCount: 0 })
      } catch {
        if (!cancelled) setState({ status: "error", message: "Network error — please try again" })
      }
    }

    void start()
    return () => {
      cancelled = true
    }
    // Intentionally only reruns if the recipient set or template changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (state.status === "idle" || state.status === "loading") {
    return (
      <AppleCard glow className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        Preparing send queue…
      </AppleCard>
    )
  }

  if (state.status === "error") {
    return (
      <AppleCard glow className="flex flex-col items-center gap-2 py-10 text-center">
        <p className="text-sm text-danger">{state.message}</p>
      </AppleCard>
    )
  }

  const { entries, index, sentCount } = state
  const total = entries.length
  const current = entries[index]
  const done = index >= total

  function handleSendAndNext() {
    if (!current) return
    window.open(current.waLink, "_blank", "noopener,noreferrer")
    const nextIndex = index + 1
    const nextSentCount = sentCount + 1
    if (nextIndex >= total) {
      setState({ status: "ready", entries, index: nextIndex, sentCount: nextSentCount })
      toast.success(`Sent to all ${total} recipients`)
      onDone?.()
    } else {
      setState({ status: "ready", entries, index: nextIndex, sentCount: nextSentCount })
    }
  }

  if (total === 0) {
    return (
      <AppleCard glow className="flex flex-col items-center gap-2 py-10 text-center">
        <p className="text-sm text-muted-foreground">No recipients to send to.</p>
      </AppleCard>
    )
  }

  return (
    <AppleCard glow className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-accent/10 text-accent">
        {done ? <CheckCircle2 {...ICON_PROPS} size={28} /> : <MessageCircle {...ICON_PROPS} size={28} />}
      </div>

      {done ? (
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold text-foreground">All {total} messages sent</p>
          <p className="text-sm text-muted-foreground">{sentCount} of {total} sent</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold text-foreground">{current.customerName}</p>
          <p className="text-sm text-muted-foreground">
            Recipient {index + 1} of {total} · {sentCount} sent so far
          </p>
        </div>
      )}

      <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${(sentCount / total) * 100}%` }}
        />
      </div>

      {!done && (
        <AppleButton onClick={handleSendAndNext}>
          Send & Next
        </AppleButton>
      )}
    </AppleCard>
  )
}
