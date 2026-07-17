import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"
import { awsClientConfig } from "@/lib/aws/credentials"
import { AWS_REGION } from "@/lib/cms/constants"

/** Cached singleton so serverless runtimes do not rebuild the client on every request. */
let client: DynamoDBDocumentClient | null = null

export function getDynamo(): DynamoDBDocumentClient {
  if (client) return client
  const base = new DynamoDBClient(awsClientConfig(AWS_REGION))
  client = DynamoDBDocumentClient.from(base, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertEmptyValues: false,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  })
  return client
}
