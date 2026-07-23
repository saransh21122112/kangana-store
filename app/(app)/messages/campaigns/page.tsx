import { getAllTemplates } from "@/lib/queries/message-templates"
import { getAllCustomers } from "@/lib/queries/customers"
import {
  getInactiveCustomers,
  getTopSpenders,
  getBirthdaysThisWeek,
  getAnniversariesThisWeek,
} from "@/lib/queries/customer-lists"
import { CampaignBuilder, type AudienceOption } from "@/components/messages/CampaignBuilder"
import { WeMissYouPanel } from "@/components/messages/WeMissYouPanel"

// See app/(app)/(dashboard)/page.tsx for why this is needed: without it,
// Next statically prerenders this page at build time, baking in whatever
// customers/templates/inactive lists existed at build time and never
// updating again until the next deploy — wrong for a live campaign builder,
// and it also requires a live DB connection during `next build` (breaks
// Docker builds run without real database credentials).
export const dynamic = "force-dynamic"

export default async function CampaignsPage() {
  const [templates, allCustomers, inactive30, topSpenders, birthdays, anniversaries] = await Promise.all([
    getAllTemplates(),
    getAllCustomers(),
    getInactiveCustomers(30),
    getTopSpenders(20),
    getBirthdaysThisWeek(),
    getAnniversariesThisWeek(),
  ])

  const audiences: AudienceOption[] = [
    {
      key: "inactive30",
      label: `Inactive 30+ (${inactive30.length})`,
      customers: inactive30.map((e) => ({
        id: e.customer.id,
        name: e.customer.name,
        mobileNumber: e.customer.mobileNumber,
      })),
    },
    {
      key: "topSpenders",
      label: `Top Spenders (${topSpenders.length})`,
      customers: topSpenders.map((c) => ({ id: c.id, name: c.name, mobileNumber: c.mobileNumber })),
    },
    {
      key: "birthdays",
      label: `Birthdays This Week (${birthdays.length})`,
      customers: birthdays.map((e) => ({
        id: e.customer.id,
        name: e.customer.name,
        mobileNumber: e.customer.mobileNumber,
      })),
    },
    {
      key: "anniversaries",
      label: `Anniversaries This Week (${anniversaries.length})`,
      customers: anniversaries.map((e) => ({
        id: e.customer.id,
        name: e.customer.name,
        mobileNumber: e.customer.mobileNumber,
      })),
    },
  ]

  const weMissYouTemplate = templates.find((t) => t.type === "WE_MISS_YOU") ?? null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Campaigns</h1>
        <p className="text-sm text-muted-foreground">
          Send templated WhatsApp messages to a group of customers. Each recipient&apos;s message opens
          in WhatsApp for you to send — nothing goes out automatically.
        </p>
      </div>

      <CampaignBuilder
        templates={templates.map((t) => ({ id: t.id, title: t.title, type: t.type }))}
        audiences={audiences}
        allCustomers={allCustomers.map((c) => ({ id: c.id, name: c.name, mobileNumber: c.mobileNumber }))}
      />

      <WeMissYouPanel
        candidates={inactive30.map((e) => ({
          id: e.customer.id,
          name: e.customer.name,
          daysSinceLastVisit: e.daysSinceLastVisit,
        }))}
        templateId={weMissYouTemplate?.id ?? null}
      />
    </div>
  )
}
