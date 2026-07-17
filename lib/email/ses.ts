import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"

import { awsClientConfig } from "@/lib/aws/credentials"

const SENDER_EMAIL =
  process.env.AMPERE_SES_SENDER_EMAIL ?? "noreply@amperecreativegroup.com"

const SES_REGION = process.env.AMPERE_SES_REGION ?? "us-east-2"

let client: SESClient | null = null

function getSes(): SESClient {
  if (!client) {
    client = new SESClient(awsClientConfig(SES_REGION))
  }
  return client
}

export interface SendEmailParams {
  to: string | string[]
  bcc?: string[]
  subject: string
  html: string
}

export async function sendEmail({
  to,
  bcc = [],
  subject,
  html,
}: SendEmailParams): Promise<void> {
  const toAddresses = Array.isArray(to) ? to : [to]

  await getSes().send(
    new SendEmailCommand({
      Source: SENDER_EMAIL,
      Destination: {
        ToAddresses: toAddresses,
        ...(bcc.length > 0 ? { BccAddresses: bcc } : {}),
      },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: { Html: { Data: html, Charset: "UTF-8" } },
      },
    })
  )
}
