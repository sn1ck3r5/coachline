import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

if (!process.env.AWS_REGION) {
  console.error("FATAL: AWS_REGION environment variable is required");
  process.exit(1);
}
if (!process.env.S3_BUCKET_NAME) {
  console.error("FATAL: S3_BUCKET_NAME environment variable is required");
  process.exit(1);
}

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.S3_BUCKET_NAME;

export async function getUploadUrl(
  key: string,
  contentType: string
): Promise<{ url: string; expiresAt: Date }> {
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  const expiresIn = 900;
  const url = await getSignedUrl(s3, command, { expiresIn });
  return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) };
}

export async function getPlaybackUrl(
  key: string
): Promise<{ url: string; expiresAt: Date }> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const expiresIn = 3600;
  const url = await getSignedUrl(s3, command, { expiresIn });
  return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) };
}

export async function getPresignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
