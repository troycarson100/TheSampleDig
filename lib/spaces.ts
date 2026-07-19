import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

// S3-compatible object storage for paid downloads. Works with DigitalOcean
// Spaces or Supabase Storage — just point the env vars at whichever:
//   SPACES_ENDPOINT  e.g. https://nyc3.digitaloceanspaces.com
//   SPACES_REGION    e.g. nyc3
//   SPACES_BUCKET    bucket name
//   SPACES_KEY / SPACES_SECRET   access key pair
const endpoint = process.env.SPACES_ENDPOINT
const region = process.env.SPACES_REGION || "us-east-1"
const bucket = process.env.SPACES_BUCKET
const accessKeyId = process.env.SPACES_KEY
const secretAccessKey = process.env.SPACES_SECRET

export function isStorageConfigured() {
  return Boolean(endpoint && bucket && accessKeyId && secretAccessKey)
}

let client: S3Client | null = null
function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId: accessKeyId as string, secretAccessKey: secretAccessKey as string },
    })
  }
  return client
}

/** Short-lived signed URL that forces a download with a friendly filename. */
export async function getSignedDownloadUrl(key: string, downloadName?: string, expiresIn = 300): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket as string,
    Key: key,
    ResponseContentDisposition: downloadName ? `attachment; filename="${downloadName}"` : undefined,
  })
  return getSignedUrl(getClient(), command, { expiresIn })
}
