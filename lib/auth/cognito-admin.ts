import { randomBytes } from "node:crypto"

import {
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider"

import { COGNITO_CLIENT_ID_ATTRIBUTE } from "@/lib/auth/constants"
import { AWS_REGION } from "@/lib/cms/constants"

let client: CognitoIdentityProviderClient | null = null

function getCognitoAdmin(): CognitoIdentityProviderClient {
  if (!client) {
    client = new CognitoIdentityProviderClient({ region: AWS_REGION })
  }
  return client
}

function getUserPoolId(): string {
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID?.trim()
  if (!userPoolId) {
    throw new Error("Cognito user pool is not configured.")
  }
  return userPoolId
}

function pickChar(chars: string): string {
  return chars[randomBytes(1)[0]! % chars.length]!
}

/** Meets the Ampere Studio pool policy: 12+ chars with upper, lower, number, symbol. */
export function generateTemporaryPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const lower = "abcdefghijkmnopqrstuvwxyz"
  const digits = "23456789"
  const symbols = "!@#$%&*"
  const all = upper + lower + digits + symbols

  const chars = [
    pickChar(upper),
    pickChar(lower),
    pickChar(digits),
    pickChar(symbols),
  ]
  for (let i = 0; i < 8; i++) chars.push(pickChar(all))

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0]! % (i + 1)
    const tmp = chars[i]!
    chars[i] = chars[j]!
    chars[j] = tmp
  }

  return chars.join("")
}

export interface InviteCognitoUserParams {
  email: string
  clientId: string
}

export interface InviteCognitoUserResult {
  email: string
  clientId: string
  temporaryPassword: string
}

export async function inviteCognitoUser({
  email,
  clientId,
}: InviteCognitoUserParams): Promise<InviteCognitoUserResult> {
  const normalizedEmail = email.trim().toLowerCase()
  const temporaryPassword = generateTemporaryPassword()

  try {
    await getCognitoAdmin().send(
      new AdminCreateUserCommand({
        UserPoolId: getUserPoolId(),
        Username: normalizedEmail,
        TemporaryPassword: temporaryPassword,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: normalizedEmail },
          { Name: "email_verified", Value: "true" },
          { Name: COGNITO_CLIENT_ID_ATTRIBUTE, Value: clientId },
        ],
      })
    )
  } catch (error) {
    if (error instanceof UsernameExistsException) {
      throw new Error("A user with this email already exists.")
    }
    throw error
  }

  return {
    email: normalizedEmail,
    clientId,
    temporaryPassword,
  }
}
