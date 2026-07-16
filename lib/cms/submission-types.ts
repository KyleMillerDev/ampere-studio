export type SubmissionStatus = "new" | "read" | "archived"

export interface Submission {
  client_id: string
  submissionId: string
  timestamp: string
  formId?: string
  serviceName?: string
  subServiceName?: string
  name?: string
  email?: string
  phone?: string
  message?: string
  fields?: Record<string, unknown>
  status?: SubmissionStatus
  source?: string
}

export function isUnreadSubmission(status?: SubmissionStatus): boolean {
  return !status || status === "new"
}
