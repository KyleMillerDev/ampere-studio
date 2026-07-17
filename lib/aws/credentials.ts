type AwsCredentials = {
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
}

/**
 * Explicit credentials for Amplify Hosting / CI where the default provider
 * chain has no profile or instance role with DynamoDB/S3 access.
 *
 * Prefer AMPERE_AWS_* so Studio keys stay separate from the machine's
 * default AWS profile. When unset, the SDK falls back to its normal chain
 * (local ~/.aws/credentials, IAM role, etc.).
 */
export function getAwsCredentials(): AwsCredentials | undefined {
  const accessKeyId = process.env.AMPERE_AWS_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.AMPERE_AWS_SECRET_ACCESS_KEY?.trim()
  const sessionToken = process.env.AMPERE_AWS_SESSION_TOKEN?.trim()

  if (!accessKeyId || !secretAccessKey) return undefined

  return sessionToken
    ? { accessKeyId, secretAccessKey, sessionToken }
    : { accessKeyId, secretAccessKey }
}

export function awsClientConfig(region: string): {
  region: string
  credentials?: AwsCredentials
} {
  const credentials = getAwsCredentials()
  return credentials ? { region, credentials } : { region }
}
