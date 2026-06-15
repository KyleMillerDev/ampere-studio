/**
 * One-time Cognito User Pool setup for Ampere Studio.
 *
 * Usage:
 *   node scripts/setup-cognito.mjs
 *
 * Reads AWS credentials from .env.local (or the default credential chain).
 * Prints NEXT_PUBLIC_* values to paste into .env.local.
 */

import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { randomUUID } from "node:crypto"

import {
  CognitoIdentityProviderClient,
  CreateUserPoolCommand,
  CreateUserPoolClientCommand,
  SetUserPoolMfaConfigCommand,
  UpdateUserPoolCommand,
  ListUserPoolsCommand,
  DescribeUserPoolCommand,
} from "@aws-sdk/client-cognito-identity-provider"
import {
  IAMClient,
  CreateRoleCommand,
  PutRolePolicyCommand,
  GetRoleCommand,
} from "@aws-sdk/client-iam"
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const ENV_PATH = resolve(ROOT, ".env.local")

const REGION = process.env.AWS_REGION || "us-east-2"
const POOL_NAME = "ampere-studio"
const APP_CLIENT_NAME = "ampere-studio-web"
const SNS_ROLE_NAME = "cognito-sns-sms-role-ampere-studio"
const SNS_EXTERNAL_ID = randomUUID()

function loadEnvFile() {
  if (!existsSync(ENV_PATH)) return
  const raw = readFileSync(ENV_PATH, "utf8")
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile()

const credentials =
  process.env.AMPERE_AWS_ACCESS_KEY_ID &&
  process.env.AMPERE_AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AMPERE_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AMPERE_AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      }
    : undefined

const cognito = new CognitoIdentityProviderClient({
  region: REGION,
  credentials,
})
const iam = new IAMClient({ region: REGION, credentials })
const sts = new STSClient({ region: REGION, credentials })

async function getAccountId() {
  const { Account } = await sts.send(new GetCallerIdentityCommand({}))
  if (!Account) throw new Error("Could not resolve AWS account ID")
  return Account
}

async function findExistingPool() {
  let nextToken
  do {
    const res = await cognito.send(
      new ListUserPoolsCommand({ MaxResults: 60, NextToken: nextToken })
    )
    const match = res.UserPools?.find((p) => p.Name === POOL_NAME)
    if (match?.Id) return match.Id
    nextToken = res.NextToken
  } while (nextToken)
  return null
}

async function ensureSnsRole(accountId) {
  const roleArn = `arn:aws:iam::${accountId}:role/${SNS_ROLE_NAME}`

  try {
    await iam.send(new GetRoleCommand({ RoleName: SNS_ROLE_NAME }))
    console.log(`  SNS role already exists: ${roleArn}`)
    return { roleArn, externalId: SNS_EXTERNAL_ID, smsAvailable: true }
  } catch (err) {
    if (err?.name !== "NoSuchEntityException") throw err
  }

  const trustPolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: "cognito-idp.amazonaws.com" },
        Action: "sts:AssumeRole",
        Condition: {
          StringEquals: { "sts:ExternalId": SNS_EXTERNAL_ID },
          ArnLike: {
            "aws:SourceArn": `arn:aws:cognito-idp:${REGION}:${accountId}:userpool/*`,
          },
        },
      },
    ],
  }

  try {
    await iam.send(
      new CreateRoleCommand({
        RoleName: SNS_ROLE_NAME,
        AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
        Description:
          "Allows Cognito User Pool ampere-studio to send SMS for MFA",
      })
    )

    await iam.send(
      new PutRolePolicyCommand({
        RoleName: SNS_ROLE_NAME,
        PolicyName: "cognito-sns-publish",
        PolicyDocument: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["sns:Publish"],
              Resource: "*",
            },
          ],
        }),
      })
    )

    console.log(`  Created SNS role: ${roleArn}`)
    return { roleArn, externalId: SNS_EXTERNAL_ID, smsAvailable: true }
  } catch (err) {
    console.warn(
      "  Could not create SNS IAM role (missing iam:CreateRole). SMS MFA will be skipped; TOTP still works."
    )
    console.warn(`  ${err.message || err}`)
    return { roleArn: null, externalId: null, smsAvailable: false }
  }
}

async function createOrGetPool(
  accountId,
  snsRoleArn,
  snsExternalId,
  smsAvailable
) {
  let poolId = await findExistingPool()

  const smsConfig =
    smsAvailable && snsRoleArn && snsExternalId
      ? {
          SmsConfiguration: {
            SnsCallerArn: snsRoleArn,
            ExternalId: snsExternalId,
          },
          SmsVerificationMessage:
            "Your Ampere Studio verification code is {####}",
        }
      : {}

  const enabledMfas = smsAvailable
    ? ["SOFTWARE_TOKEN_MFA", "SMS_MFA"]
    : ["SOFTWARE_TOKEN_MFA"]

  if (poolId) {
    console.log(`  User pool "${POOL_NAME}" already exists: ${poolId}`)
    if (smsAvailable && snsRoleArn && snsExternalId) {
      await cognito.send(
        new UpdateUserPoolCommand({
          UserPoolId: poolId,
          ...smsConfig,
        })
      )
    }
    return { poolId, smsAvailable }
  }

  const created = await cognito.send(
    new CreateUserPoolCommand({
      PoolName: POOL_NAME,
      UsernameAttributes: ["email"],
      AutoVerifiedAttributes: ["email"],
      AdminCreateUserConfig: {
        AllowAdminCreateUserOnly: true,
      },
      MfaConfiguration: "OPTIONAL",
      EnabledMfas: enabledMfas,
      ...smsConfig,
      Policies: {
        PasswordPolicy: {
          MinimumLength: 12,
          RequireLowercase: true,
          RequireUppercase: true,
          RequireNumbers: true,
          RequireSymbols: true,
          TemporaryPasswordValidityDays: 7,
        },
      },
      Schema: [
        {
          Name: "email",
          AttributeDataType: "String",
          Required: true,
          Mutable: true,
        },
        {
          Name: "phone_number",
          AttributeDataType: "String",
          Required: false,
          Mutable: true,
        },
        {
          Name: "client_id",
          AttributeDataType: "String",
          Required: false,
          Mutable: true,
        },
      ],
      AccountRecoverySetting: {
        RecoveryMechanisms: [{ Name: "verified_email", Priority: 1 }],
      },
      UserPoolTags: {
        Application: "ampere-studio",
      },
    })
  )

  poolId = created.UserPool?.Id
  if (!poolId) throw new Error("CreateUserPool did not return a pool ID")
  console.log(`  Created user pool: ${poolId}`)
  return { poolId, smsAvailable }
}

async function configureMfa(poolId, smsAvailable) {
  await cognito.send(
    new SetUserPoolMfaConfigCommand({
      UserPoolId: poolId,
      MfaConfiguration: "OPTIONAL",
      SoftwareTokenMfaConfiguration: { Enabled: true },
      ...(smsAvailable ? { SmsMfaConfiguration: { Enabled: true } } : {}),
    })
  )
  console.log(
    smsAvailable
      ? "  MFA configured: OPTIONAL (TOTP + SMS)"
      : "  MFA configured: OPTIONAL (TOTP only; add SNS role for SMS)"
  )
}

async function createAppClient(poolId) {
  const created = await cognito.send(
    new CreateUserPoolClientCommand({
      UserPoolId: poolId,
      ClientName: APP_CLIENT_NAME,
      GenerateSecret: false,
      ExplicitAuthFlows: [
        "ALLOW_USER_SRP_AUTH",
        "ALLOW_REFRESH_TOKEN_AUTH",
        "ALLOW_USER_PASSWORD_AUTH",
      ],
      PreventUserExistenceErrors: "ENABLED",
      EnableTokenRevocation: true,
      AccessTokenValidity: 1,
      IdTokenValidity: 1,
      RefreshTokenValidity: 30,
      TokenValidityUnits: {
        AccessToken: "hours",
        IdToken: "hours",
        RefreshToken: "days",
      },
      ReadAttributes: ["email", "phone_number", "custom:client_id"],
      WriteAttributes: ["email", "phone_number"],
    })
  )

  const clientId = created.UserPoolClient?.ClientId
  if (!clientId)
    throw new Error("CreateUserPoolClient did not return a client ID")
  console.log(`  Created app client: ${clientId}`)
  return clientId
}

async function main() {
  console.log("\nAmpere Studio Cognito setup")
  console.log(`Region: ${REGION}\n`)

  const accountId = await getAccountId()
  console.log(`AWS account: ${accountId}`)

  const { roleArn, externalId, smsAvailable } = await ensureSnsRole(accountId)
  const { poolId, smsAvailable: poolSms } = await createOrGetPool(
    accountId,
    roleArn,
    externalId,
    smsAvailable
  )
  await configureMfa(poolId, poolSms)

  const pool = await cognito.send(
    new DescribeUserPoolCommand({ UserPoolId: poolId })
  )
  const existingClients = pool.UserPool?.SchemaAttributes

  let clientId
  try {
    clientId = await createAppClient(poolId)
  } catch (err) {
    if (
      err?.name === "InvalidParameterException" &&
      /already exists/i.test(err.message)
    ) {
      console.log(
        "  App client may already exist. Create a new one in the console if needed."
      )
      clientId = "<create-or-find-in-console>"
    } else {
      throw err
    }
  }

  void existingClients

  console.log("\n--- Add these to .env.local ---\n")
  console.log(`NEXT_PUBLIC_AWS_REGION=${REGION}`)
  console.log(`NEXT_PUBLIC_COGNITO_USER_POOL_ID=${poolId}`)
  console.log(`NEXT_PUBLIC_COGNITO_CLIENT_ID=${clientId}`)
  console.log("\n--- SMS MFA note ---")
  console.log(
    "New AWS accounts are in the SNS SMS sandbox. SMS MFA only reaches verified phone numbers until you request production SMS access in the SNS console."
  )
  console.log("\n--- Create users ---")
  console.log(
    "In the Cognito console: Users > Create user > set email + temporary password > mark email verified."
  )
  console.log(
    "Set custom:client_id on every user (e.g. ampere, acme-corp). This scopes CMS data per client."
  )
  console.log("")
}

main().catch((err) => {
  console.error("\nSetup failed:", err.message || err)
  process.exit(1)
})
