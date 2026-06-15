import AdmZip from "adm-zip"
import fs from "node:fs/promises"
import path from "node:path"

/**
 * Extract a zipball buffer into `destination` and return the top-level
 * directory that GitHub adds (e.g. `owner-repo-0abcdef/`). If the archive
 * does not have a single root directory, `destination` is returned as-is.
 */
export async function extractZipball(params: {
  buffer: Buffer
  destination: string
}): Promise<string> {
  await fs.mkdir(params.destination, { recursive: true })

  const zip = new AdmZip(params.buffer)
  zip.extractAllTo(params.destination, true)

  const entries = await fs.readdir(params.destination, { withFileTypes: true })
  const dirs = entries.filter((e) => e.isDirectory())
  if (dirs.length === 1) {
    return path.join(params.destination, dirs[0].name)
  }
  return params.destination
}
