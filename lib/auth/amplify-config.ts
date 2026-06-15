import type { ResourcesConfig } from "aws-amplify"

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID?.trim() ?? ""
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID?.trim() ?? ""

export const isAuthConfigured = Boolean(userPoolId && userPoolClientId)

export const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: userPoolId || "unset",
      userPoolClientId: userPoolClientId || "unset",
      loginWith: {
        email: true,
      },
      mfa: {
        totpEnabled: true,
        smsEnabled: true,
      },
    },
  },
}
