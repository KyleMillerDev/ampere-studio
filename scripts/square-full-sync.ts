/**
 * One-time full Square → DynamoDB mirror rebuild.
 *
 * Run locally during initial setup to populate the Ampere-Studio-Content
 * table with all Square catalog objects (including archived/draft items) and
 * the most recent orders.
 *
 * Usage:
 *   npx tsx scripts/square-full-sync.ts <client_id>
 *
 * Prerequisites:
 *  - AWS credentials in env/profile (must have DynamoDB + Secrets Manager access)
 *  - The {client_id}/square secret must exist in Secrets Manager
 *  - Set AWS_REGION if you're not using us-east-1 (or set in .env.local)
 */

import { config } from "dotenv"
import path from "path"

// Load .env.local first so process.env picks up any local overrides
config({ path: path.resolve(process.cwd(), ".env.local") })
config({ path: path.resolve(process.cwd(), ".env") })

async function main() {
  const clientId = process.argv[2]
  if (!clientId) {
    console.error("Usage: npx tsx scripts/square-full-sync.ts <client_id>")
    process.exit(1)
  }

  console.log(`Starting full Square mirror rebuild for client: ${clientId}`)

  // Dynamically import after env has loaded
  const { getSquareSecret } = await import("../lib/aws/secrets")
  const { buildSquareClient } = await import("../lib/square/client")
  const { fullRebuild } = await import("../lib/square/sync")

  const tokens = await getSquareSecret(clientId)
  if (!tokens) {
    console.error(`No Square credentials found for client "${clientId}".`)
    console.error(
      `Create the secret at "${clientId}/square" in AWS Secrets Manager first.`
    )
    process.exit(1)
  }

  console.log(
    `Found credentials. Environment: ${tokens.environment}, Location: ${tokens.location_id}`
  )

  const squareClient = buildSquareClient(tokens)

  const result = await fullRebuild(squareClient, clientId, tokens.location_id)

  console.log("\nFull rebuild complete:")
  console.log(`  Items (products):   ${result.items}`)
  console.log(`  Categories:         ${result.categories}`)
  console.log(`  Discounts:          ${result.discounts}`)
  console.log(`  Item options:       ${result.options}`)
  console.log(`  Modifier lists:     ${result.modifierLists}`)
  console.log(`  Orders:             ${result.orders}`)

  if (result.errors.length > 0) {
    console.warn(`\nEncountered ${result.errors.length} error(s):`)
    result.errors.forEach((e, i) => console.warn(`  ${i + 1}. ${e}`))
    process.exit(1)
  } else {
    console.log("\nNo errors. Mirror is fully populated.")
  }
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
