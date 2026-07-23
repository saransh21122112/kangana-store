"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { createUserSchema, type CreateUserInput } from "@/lib/validations/settings"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AppleButton } from "@/components/apple/AppleButton"
import { AppleCard } from "@/components/apple/AppleCard"
import { AppleSheet } from "@/components/apple/AppleSheet"
import { AppleBadge } from "@/components/apple/Badge"
import { cn } from "@/lib/utils"

export interface UserRow {
  id: string
  name: string
  email: string
  role: "OWNER" | "STAFF"
  createdAt: string | Date
}

export interface UserManagementTableProps {
  /** Server-fetched initial list, passed in by the settings page. */
  initialUsers: UserRow[]
}

type AddUserFormValues = CreateUserInput

function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })
}

/** Small inline form rendered inside the "Add User" AppleSheet. */
function AddUserForm({ onSuccess }: { onSuccess: (user: UserRow) => void }) {
  const [role, setRole] = React.useState<"OWNER" | "STAFF">("STAFF")
  const [serverError, setServerError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<AddUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "STAFF",
    },
  })

  const submit = handleSubmit(async (data) => {
    setServerError(null)
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, role }),
      })
      const json = await res.json()

      if (res.status === 409) {
        setError("email", { message: json.error ?? "A user with this email already exists" })
        return
      }
      if (!res.ok) {
        const message: string = json?.error ?? "Could not add user. Please try again."
        setServerError(message)
        toast.error(message)
        return
      }

      toast.success("User added.")
      onSuccess(json.user as UserRow)
    } catch {
      const message = "Network error. Please try again."
      setServerError(message)
      toast.error(message)
    }
  })

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-user-name">Name</Label>
        <Input id="new-user-name" placeholder="e.g. Priya Sharma" {...register("name")} />
        {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-user-email">Email</Label>
        <Input
          id="new-user-email"
          type="email"
          placeholder="e.g. staff@kangnabeauty.in"
          {...register("email", { onChange: () => clearErrors("email") })}
        />
        {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-user-password">Password</Label>
        <Input id="new-user-password" type="password" placeholder="At least 6 characters" {...register("password")} />
        {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-user-role">Role</Label>
        <Select value={role} onValueChange={(val) => setRole(val as "OWNER" | "STAFF")}>
          <SelectTrigger id="new-user-role" className="w-full">
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="STAFF">Staff</SelectItem>
            <SelectItem value="OWNER">Owner</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {serverError && <p className="text-sm text-danger">{serverError}</p>}

      <AppleButton type="submit" disabled={isSubmitting} className={cn("mt-2")}>
        {isSubmitting ? "Adding..." : "Add User"}
      </AppleButton>
    </form>
  )
}

/**
 * User management table for Settings → Users: lists all users with a
 * role-toggle and delete action per row (both blocked client-side for the
 * logged-in user's own row, mirroring the server's self-demote/self-delete
 * guards), plus an "Add User" sheet. Manages its own local `users` state so
 * it's fully interactive without requiring the parent page to re-render.
 */
export function UserManagementTable({ initialUsers }: UserManagementTableProps) {
  const { data: session } = useSession()
  const currentUserId = session?.user?.id

  const [users, setUsers] = React.useState<UserRow[]>(initialUsers)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [pendingRoleId, setPendingRoleId] = React.useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null)

  async function refetchUsers() {
    try {
      const res = await fetch("/api/settings/users")
      if (!res.ok) return
      const json = await res.json()
      setUsers(json.users as UserRow[])
    } catch {
      // Keep showing current state — nothing actionable to surface here.
    }
  }

  async function toggleRole(user: UserRow) {
    if (user.id === currentUserId) return
    const nextRole = user.role === "OWNER" ? "STAFF" : "OWNER"

    setPendingRoleId(user.id)
    try {
      const res = await fetch("/api/settings/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: nextRole }),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json?.error ?? "Could not update role. Please try again.")
        return
      }

      setUsers((prev) => prev.map((u) => (u.id === user.id ? (json.user as UserRow) : u)))
      toast.success(`${user.name}'s role is now ${nextRole}.`)
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setPendingRoleId(null)
    }
  }

  async function deleteUser(user: UserRow) {
    if (user.id === currentUserId) return
    if (!window.confirm(`Delete ${user.name} (${user.email})? This can't be undone.`)) return

    setPendingDeleteId(user.id)
    try {
      const res = await fetch(`/api/settings/users?id=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json?.error ?? "Could not delete user. Please try again.")
        return
      }

      setUsers((prev) => prev.filter((u) => u.id !== user.id))
      toast.success(`${user.name} was removed.`)
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setPendingDeleteId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Label>Users</Label>
        <AppleButton type="button" variant="secondary" size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4" />
          Add User
        </AppleButton>
      </div>

      <AppleCard noPadding className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === currentUserId
                return (
                  <tr key={user.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{user.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <AppleBadge variant={user.role === "OWNER" ? "vip" : "neutral"}>
                        {user.role}
                      </AppleBadge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <AppleButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isSelf || pendingRoleId === user.id}
                          onClick={() => toggleRole(user)}
                        >
                          {pendingRoleId === user.id
                            ? "Updating..."
                            : `Make ${user.role === "OWNER" ? "Staff" : "Owner"}`}
                        </AppleButton>
                        <AppleButton
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={isSelf || pendingDeleteId === user.id}
                          onClick={() => deleteUser(user)}
                        >
                          {pendingDeleteId === user.id ? "Deleting..." : "Delete"}
                        </AppleButton>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AppleCard>

      <AppleSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Add User"
        description="Create a new team member account."
      >
        <AddUserForm
          onSuccess={() => {
            setSheetOpen(false)
            void refetchUsers()
          }}
        />
      </AppleSheet>
    </div>
  )
}
