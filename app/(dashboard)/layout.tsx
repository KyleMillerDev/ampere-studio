import { cookies } from "next/headers"

import { AppSidebar } from "@/components/cms/app-sidebar"
import { DashboardHeader } from "@/components/cms/dashboard-header"
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
import { isStripeOrdersEnabled } from "@/lib/stripe/config"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"
  const activeClientId = await getActiveClientId()
  const [activeClient, features, ordersEnabled] = await Promise.all([
    getActiveClient(),
    getActiveClientFeatures(),
    isStripeOrdersEnabled().catch(() => false),
  ])
  const devClients = isDevClientSwitchEnabled()
    ? await listClients().catch(() => [])
    : []

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        clientName={activeClient.name}
        features={features}
        ordersEnabled={ordersEnabled}
      />
      <SidebarInset>
        <DashboardHeader
          activeClientId={activeClientId}
          devClients={devClients}
        />
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
