import { getAllTemplates } from "@/lib/queries/message-templates"
import { TemplateEditor } from "@/components/messages/TemplateEditor"
import { EmptyState } from "@/components/apple/EmptyState"
import { MessageSquare } from "lucide-react"

// See app/(app)/(dashboard)/page.tsx for why this is needed: without it,
// Next statically prerenders this page at build time, so an edit made via
// "Save Changes" would never show up here on reload in production (it would
// keep serving the build-time snapshot) and `next build` requires a live DB
// connection just to prerender it.
export const dynamic = "force-dynamic"

export default async function MessageTemplatesPage() {
  const templates = await getAllTemplates()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Message Templates</h1>
        <p className="text-sm text-muted-foreground">
          Edit the wording sent for each message type. Changes apply the next time a message of
          that type is sent.
        </p>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No templates yet"
          description="Message templates are seeded automatically — none were found."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {templates.map((template) => (
            <TemplateEditor key={template.id} template={template} />
          ))}
        </div>
      )}
    </div>
  )
}
