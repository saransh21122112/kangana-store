"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Upload } from "lucide-react"
import { toast } from "sonner"

import { AppleButton } from "@/components/apple/AppleButton"
import { ICON_PROPS } from "@/lib/icon-map"

interface ImportSummary {
  updated: number
  skipped: number
  errors: string[]
}

/**
 * "Import CSV" button for `/inventory`, OWNER-only (mirrors
 * `DeleteInventoryItemButton`'s OWNER-only fetch + toast + `router.refresh`
 * shape). A plain hidden `<input type="file">` triggered by the button
 * rather than a drag-and-drop zone — this is a one-off bulk-price-update
 * flow (export, edit in Excel, re-upload), not a recurring interaction that
 * needs its own affordance.
 */
export function ImportInventoryButton() {
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [pending, setPending] = React.useState(false)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset so selecting the same file again still fires onChange.
    e.target.value = ""
    if (!file) return

    setPending(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/inventory/import", {
        method: "POST",
        body: formData,
      })
      const json: (ImportSummary & { error?: string }) | null = await res.json().catch(() => null)

      if (!res.ok || !json) {
        toast.error(json?.error ?? "Could not import CSV. Please try again.")
        return
      }

      const { updated, skipped, errors } = json
      const summary = `Imported: ${updated} updated, ${skipped} skipped.`
      if (errors.length > 0) {
        toast.warning(summary, {
          description: errors.slice(0, 5).join("\n") + (errors.length > 5 ? `\n…and ${errors.length - 5} more` : ""),
        })
      } else {
        toast.success(summary)
      }
      router.refresh()
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />
      <AppleButton
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        <Upload {...ICON_PROPS} size={18} />
        {pending ? "Importing..." : "Import CSV"}
      </AppleButton>
    </>
  )
}
