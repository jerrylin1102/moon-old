import { Client } from 'minio';
import { env, minioEnabled } from '../env';

/**
 * 社群願望投稿者的頭像快取。Postgres（users.avatar_url）只存「網址」這個參照，
 * 實體圖片放這裡——不再長期依賴 Google 圖片網址（可能過期、被 rate limit、換帳號後失效）。
 *
 * 沒設全 MINIO_* 環境變數就整組停用，呼叫端一律 fallback 回原本的來源網址，不擋登入這條熱路徑。
 */
const client: Client | null = minioEnabled
  ? new Client({
      endPoint: env.MINIO_ENDPOINT!,
      port: env.MINIO_PORT,
      useSSL: env.MINIO_USE_SSL,
      accessKey: env.MINIO_ACCESS_KEY!,
      secretKey: env.MINIO_SECRET_KEY!,
    })
  : null;

let bucketReady = false;

/**
 * Node 的 AggregateError 本身 `String()` 只會印出 "AggregateError"，
 * 真正的原因（ECONNREFUSED／ENOTFOUND／憑證錯誤……）都包在 `.errors` 裡，攤開來才看得到。
 */
function describeError(err: unknown): string {
  if (err instanceof AggregateError) {
    return err.errors.map((e) => (e instanceof Error ? e.message : String(e))).join('; ');
  }
  return err instanceof Error ? err.message : String(err);
}

/** 開機時確認 bucket 存在，不存在就建立。失敗只記警告，不讓整個服務起不來 */
export async function ensureAvatarBucket(log: { warn: (msg: string) => void }): Promise<void> {
  if (!client) return;
  try {
    const exists = await client.bucketExists(env.MINIO_BUCKET);
    if (!exists) await client.makeBucket(env.MINIO_BUCKET);
    bucketReady = true;
  } catch (err) {
    log.warn(
      `MinIO bucket 準備失敗（endPoint=${env.MINIO_ENDPOINT}:${env.MINIO_PORT} useSSL=${env.MINIO_USE_SSL}），` +
        `頭像快取本次開機停用：${describeError(err)}`,
    );
    bucketReady = false;
  }
}

function publicUrlFor(objectName: string): string {
  if (env.MINIO_PUBLIC_URL) return `${env.MINIO_PUBLIC_URL.replace(/\/$/, '')}/${objectName}`;
  const scheme = env.MINIO_USE_SSL ? 'https' : 'http';
  return `${scheme}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}/${env.MINIO_BUCKET}/${objectName}`;
}

/**
 * 把來源圖片網址（Google 頭像）下載一次、快取進 MinIO，回傳快取後的公開網址。
 * 任何一步失敗都回傳 null——呼叫端 fallback 回原本的來源網址，不影響登入流程。
 */
export async function cacheAvatar(sourceUrl: string, userId: string): Promise<string | null> {
  if (!client || !bucketReady) return null;

  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    const objectName = `avatars/${userId}.jpg`;

    await client.putObject(env.MINIO_BUCKET, objectName, buffer, buffer.length, {
      'Content-Type': contentType,
    });

    return publicUrlFor(objectName);
  } catch {
    return null;
  }
}
