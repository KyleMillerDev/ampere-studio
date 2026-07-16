import { PageHeading } from "@/components/cms/page-heading"
import { SquareOAuthForm } from "@/components/cms/square/square-oauth-form"
import { getSquareTokens } from "@/lib/square/config"

export const dynamic = "force-dynamic"

export default async function SquareSettingsPage() {
  const tokens = await getSquareTokens()

  const status = {
    connected: tokens !== null,
    location_id: tokens?.location_id,
    environment: tokens?.environment,
    redirect_url: tokens?.redirect_url,
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Square settings"
        description="Manage the Square API connection for this client."
      />
      <SquareOAuthForm status={status} />
    </div>
  )
}
