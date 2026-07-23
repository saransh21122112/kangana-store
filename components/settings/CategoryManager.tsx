"use client"

import * as React from "react"
import { X, ChevronUp, ChevronDown, Plus } from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AppleButton } from "@/components/apple/AppleButton"
import { cn } from "@/lib/utils"

export interface CategoryManagerProps {
  /** Initial category list, fetched server-side by the settings page. */
  defaultCategories: string[]
}

/**
 * Small internal tool for editing the bill-category list: in-place text
 * inputs (no separate "edit mode"), up/down reorder buttons (no
 * drag-and-drop — over-engineering for this list size), and a single
 * "Save Categories" button that PATCHes the whole array at once.
 */
export function CategoryManager({ defaultCategories }: CategoryManagerProps) {
  const [categories, setCategories] = React.useState<string[]>(defaultCategories)
  const [isSaving, setIsSaving] = React.useState(false)
  const [fieldError, setFieldError] = React.useState<string | null>(null)

  function updateAt(index: number, value: string) {
    setCategories((prev) => prev.map((cat, i) => (i === index ? value : cat)))
  }

  function removeAt(index: number) {
    setCategories((prev) => prev.filter((_, i) => i !== index))
  }

  function addBlank() {
    setCategories((prev) => [...prev, ""])
  }

  function moveUp(index: number) {
    if (index === 0) return
    setCategories((prev) => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  function moveDown(index: number) {
    setCategories((prev) => {
      if (index === prev.length - 1) return prev
      const next = [...prev]
      ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
      return next
    })
  }

  async function save() {
    setFieldError(null)
    const cleaned = categories.map((cat) => cat.trim()).filter((cat) => cat.length > 0)

    setIsSaving(true)
    try {
      const res = await fetch("/api/settings/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: cleaned }),
      })
      const json = await res.json()

      if (!res.ok) {
        const message: string =
          json?.issues?.properties?.categories?.errors?.[0] ??
          json?.error ??
          "Could not save categories. Please try again."
        setFieldError(message)
        toast.error(message)
        return
      }

      setCategories(json.categories as string[])
      toast.success("Categories saved.")
    } catch {
      const message = "Network error. Please try again."
      setFieldError(message)
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <Label>Bill Categories</Label>

      <div className="flex flex-col gap-2">
        {categories.map((cat, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <Input
              value={cat}
              placeholder="Category name"
              onChange={(e) => updateAt(index, e.target.value)}
              className="flex-1"
            />
            <AppleButton
              type="button"
              variant="ghost"
              size="sm"
              className="px-1.5"
              disabled={index === 0}
              onClick={() => moveUp(index)}
              aria-label="Move up"
            >
              <ChevronUp className="h-4 w-4" />
            </AppleButton>
            <AppleButton
              type="button"
              variant="ghost"
              size="sm"
              className="px-1.5"
              disabled={index === categories.length - 1}
              onClick={() => moveDown(index)}
              aria-label="Move down"
            >
              <ChevronDown className="h-4 w-4" />
            </AppleButton>
            <AppleButton
              type="button"
              variant="ghost"
              size="sm"
              className="px-1.5 text-danger"
              onClick={() => removeAt(index)}
              aria-label="Remove category"
            >
              <X className="h-4 w-4" />
            </AppleButton>
          </div>
        ))}

        {categories.length === 0 && (
          <p className="text-sm text-muted-foreground">No categories yet — add one below.</p>
        )}
      </div>

      <AppleButton type="button" variant="secondary" size="sm" onClick={addBlank} className="self-start">
        <Plus className="h-4 w-4" />
        Add Category
      </AppleButton>

      {fieldError && <p className="text-xs text-danger">{fieldError}</p>}

      <AppleButton
        type="button"
        disabled={isSaving}
        onClick={save}
        className={cn("mt-2 self-start")}
      >
        {isSaving ? "Saving..." : "Save Categories"}
      </AppleButton>
    </div>
  )
}
