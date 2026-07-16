import { redirect } from "next/navigation"

import { isSquareOrdersEnabled } from "@/lib/square/config"
import { SalesOverview } from "@/components/cms/square/sales-overview"

export const dynamic = "force-dynamic"

export default async function SquareAnalyticsPage() {
  const enabled = await isSquareOrdersEnabled()
  if (!enabled) redirect("/dashboard")

  return <SalesOverview />

  if (!summary) {
    return (
      <div className="space-y-6">
        <PageHeading
          title="Analytics"
          description="Revenue and order trends from your Square orders."
        />
        <p className="text-muted-foreground">Could not load analytics data.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Analytics"
        description={`Last 30 days: ${summary.date_from} to ${summary.date_to}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Total revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoney(summary.total_revenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.order_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Avg order value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoney(summary.avg_order_value)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Sales tax collected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoney(summary.total_sales_tax)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orders by state</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              {Object.entries(summary.orders_by_state).map(([state, count]) => (
                <div key={state} className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">
                    {state.replace("_", " ")}
                  </dt>
                  <dd className="font-medium">{count}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top products (by revenue)</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.top_products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No completed orders yet.
              </p>
            ) : (
              <dl className="space-y-2">
                {summary.top_products.map((p) => (
                  <div key={p.id} className="flex justify-between">
                    <dt className="max-w-[65%] truncate text-sm">{p.name}</dt>
                    <dd className="font-medium">{formatMoney(p.revenue)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>

        {summary.recent_orders.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {summary.recent_orders.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {o.id.slice(-8)}
                    </span>
                    <span className="mx-4 flex-1 truncate">
                      {o.product_name}
                      {o.extra_items > 0 && (
                        <span className="ml-1 text-muted-foreground">
                          +{o.extra_items}
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground">
                      {formatMoney(o.total_money.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
