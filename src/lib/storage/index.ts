import { env } from "@/env";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = env.STORAGE_ENDPOINT
  ? new S3Client({
      region: "auto",
      endpoint: env.STORAGE_ENDPOINT,
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY_ID ?? "",
        secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY ?? "",
      },
    })
  : null;

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  if (!s3) throw new Error("Storage not configured");

  await s3.send(
    new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  const publicUrl = env.NEXT_PUBLIC_STORAGE_PUBLIC_URL;
  return publicUrl ? `${publicUrl}/${key}` : key;
}

export async function getPresignedUploadUrl(key: string, contentType: string): Promise<string> {
  if (!s3) throw new Error("Storage not configured");

  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 3600 },
  );
}

export async function getPresignedDownloadUrl(key: string): Promise<string> {
  if (!s3) throw new Error("Storage not configured");

  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: env.STORAGE_BUCKET_NAME,
      Key: key,
    }),
    { expiresIn: 3600 },
  );
}

export async function deleteFile(key: string): Promise<void> {
  if (!s3) throw new Error("Storage not configured");

  await s3.send(
    new DeleteObjectCommand({
      Bucket: env.STORAGE_BUCKET_NAME,
      Key: key,
    }),
  );
}
