import { AppSidebar } from "@/components/cms/app-sidebar"
import { DashboardHeader } from "@/components/cms/dashboard-header"
import { MobileBottomNav } from "@/components/cms/mobile-bottom-nav"
import { UnreadSubmissionsBanner } from "@/components/cms/unread-submissions-banner"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  getActiveClientId,
  isDevClientSwitchEnabled,
} from "@/lib/cms/client-context"
import {
  getActiveClient,
  getActiveClientFeatures,
  listClients,
} from "@/lib/cms/clients"
import { countUnreadSubmissions } from "@/lib/cms/submissions"
import { isStripeOrdersEnabled } from "@/lib/stripe/config"
import { isSquareEnabled, isSquareOrdersEnabled } from "@/lib/square/config"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const activeClientId = await getActiveClientId()
  const [activeClient, features] = await Promise.all([
    getActiveClient(),
    getActiveClientFeatures(),
  ])

  // Load order / Square flags conditionally based on catalog provider
  let ordersEnabled = false
  let squareEnabled = false
  let squareOrdersEnabled = false

  if (features.catalog === "stripe") {
    ordersEnabled = await isStripeOrdersEnabled().catch(() => false)
  } else if (features.catalog === "square") {
    squareEnabled = await isSquareEnabled().catch(() => false)
    squareOrdersEnabled = squareEnabled
      ? await isSquareOrdersEnabled().catch(() => false)
      : false
  }

  const devClients = isDevClientSwitchEnabled()
    ? await listClients().catch(() => [])
    : []

  const unreadSubmissionsCount = features.submissions
    ? await countUnreadSubmissions().catch(() => 0)
    : 0

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar
        clientName={activeClient.name}
        features={features}
        ordersEnabled={ordersEnabled}
        squareEnabled={squareEnabled}
        squareOrdersEnabled={squareOrdersEnabled}
        unreadSubmissionsCount={unreadSubmissionsCount}
        activeClientId={activeClientId}
        devClients={devClients}
      />
      <SidebarInset>
        <DashboardHeader
          activeClientId={activeClientId}
          devClients={devClients}
        />
        <UnreadSubmissionsBanner count={unreadSubmissionsCount} />
        <div className="flex-1 overflow-y-auto px-6 py-6 pb-20 md:pb-6">
          {children}
        </div>
      </SidebarInset>
      <MobileBottomNav
        features={features}
        ordersEnabled={ordersEnabled}
        squareOrdersEnabled={squareOrdersEnabled}
        unreadSubmissionsCount={unreadSubmissionsCount}
      />
    </SidebarProvider>
  )
}
