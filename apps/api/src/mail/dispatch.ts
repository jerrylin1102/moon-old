import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { db, schema } from '../db/client';
import { sendMail } from './transport';
import { digestMail, firstInteractionMail } from './templates';

/**
 * 通知的實際寄送。
 *
 * 兩種節奏（使用者選的）：
 * - kind='first'：某則願望第一次被互動，立刻寄
 * - kind='digest'：其餘全部累積，每人每天一封彙總
 *
 * 兩者都尊重 users.email_opt_in。寄完就把 sent_at 補上，避免重複寄。
 */

/** 同一個人兩封彙總信之間至少隔這麼久 */
const DIGEST_INTERVAL_HOURS = 20;

interface PendingRow {
  id: string;
  userId: string;
  submissionId: string | null;
  kind: 'first' | 'digest';
  payload: unknown;
  email: string;
  emailOptIn: boolean;
  wishText: string | null;
}

async function loadPending(): Promise<PendingRow[]> {
  if (!db) return [];
  return db
    .select({
      id: schema.notifications.id,
      userId: schema.notifications.userId,
      submissionId: schema.notifications.submissionId,
      kind: schema.notifications.kind,
      payload: schema.notifications.payload,
      email: schema.users.email,
      emailOptIn: schema.users.emailOptIn,
      wishText: schema.submissions.text,
    })
    .from(schema.notifications)
    .innerJoin(schema.users, eq(schema.users.id, schema.notifications.userId))
    .leftJoin(schema.submissions, eq(schema.submissions.id, schema.notifications.submissionId))
    .where(isNull(schema.notifications.sentAt))
    .limit(500);
}

async function markSent(ids: string[]): Promise<void> {
  if (!db || ids.length === 0) return;
  await db
    .update(schema.notifications)
    .set({ sentAt: new Date() })
    .where(inArray(schema.notifications.id, ids));
}

function describe(payload: unknown): string {
  const event = payload as { type?: string; action?: string; excerpt?: string };
  if (event?.type === 'comment') return `留言：「${event.excerpt ?? ''}」`;
  return `有人回應了你的願望（${event?.action ?? '未知'}）`;
}

/** 跑一輪：即時信全寄，彙總信依每人每日一封的規則寄 */
export async function dispatchNotifications(log?: FastifyBaseLogger): Promise<{
  immediate: number;
  digests: number;
  skipped: number;
}> {
  if (!db) return { immediate: 0, digests: 0, skipped: 0 };

  const pending = await loadPending();
  if (pending.length === 0) return { immediate: 0, digests: 0, skipped: 0 };

  const sentIds: string[] = [];
  let immediate = 0;
  let skipped = 0;

  // 關掉通知的人：紀錄一樣標成已處理，不然會永遠卡在待寄清單裡
  const optedOut = pending.filter((p) => !p.emailOptIn);
  sentIds.push(...optedOut.map((p) => p.id));
  skipped += optedOut.length;

  for (const row of pending.filter((p) => p.emailOptIn && p.kind === 'first')) {
    const mail = firstInteractionMail(row.wishText ?? '（願望已被收回）', row.payload as never);
    await sendMail({ to: row.email, subject: mail.subject, text: mail.text });
    sentIds.push(row.id);
    immediate += 1;
  }

  // 彙總：按人分組
  const byUser = new Map<string, PendingRow[]>();
  for (const row of pending.filter((p) => p.emailOptIn && p.kind === 'digest')) {
    const bucket = byUser.get(row.userId) ?? [];
    bucket.push(row);
    byUser.set(row.userId, bucket);
  }

  let digests = 0;
  for (const [userId, rows] of byUser) {
    // 這個人最近寄過彙總了嗎
    const since = new Date(Date.now() - DIGEST_INTERVAL_HOURS * 60 * 60 * 1000);
    const [{ recent } = { recent: 0 }] = await db
      .select({ recent: sql<number>`count(*)::int` })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.kind, 'digest'),
          sql`${schema.notifications.sentAt} is not null`,
          sql`${schema.notifications.sentAt} > ${since}`,
        ),
      );

    if (recent > 0) continue; // 今天寄過了，剩下的留到明天

    const comments = rows.filter((r) => (r.payload as { type?: string })?.type === 'comment').length;
    const mail = digestMail({
      wishes: new Set(rows.map((r) => r.submissionId)).size,
      interactions: rows.length,
      comments,
      samples: rows.slice(0, 5).map((r) => describe(r.payload)),
    });

    const target = rows[0];
    if (!target) continue;

    await sendMail({ to: target.email, subject: mail.subject, text: mail.text });
    sentIds.push(...rows.map((r) => r.id));
    digests += 1;
  }

  await markSent(sentIds);
  log?.info({ immediate, digests, skipped }, '通知寄送完成');
  return { immediate, digests, skipped };
}

/** 每小時跑一次就夠——即時信最多延遲一小時，彙總本來就是一天一封 */
export function startNotificationLoop(log: FastifyBaseLogger): NodeJS.Timeout {
  const tick = () => {
    void dispatchNotifications(log).catch((err) => log.error({ err }, '通知寄送失敗'));
  };
  tick();
  return setInterval(tick, 60 * 60 * 1000);
}
