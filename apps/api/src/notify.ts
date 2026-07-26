import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from './db/client';
import { dispatchNotifications } from './mail/dispatch';

/**
 * 把「有人動了你的願望」記成待寄通知。
 *
 * 規則（使用者選的）：某則願望第一次被互動就即時寄一封，
 * 之後全部累積起來，每天寄一封彙總。這裡只負責入列，實際寄信在 mail/digest.ts。
 */
export type NotifyEvent =
  | { type: 'interaction'; action: string }
  | { type: 'comment'; excerpt: string };

export async function queueNotification(
  submissionId: string,
  authorId: string | null,
  actorUserId: string | null,
  event: NotifyEvent,
): Promise<void> {
  if (!db || !authorId) return;
  // 自己動自己的願望不用通知
  if (actorUserId && actorUserId === authorId) return;

  // 這則願望之前有沒有寄過即時通知？沒有的話這次就是「第一次」
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.submissionId, submissionId),
        eq(schema.notifications.kind, 'first'),
      ),
    );

  const kind = count === 0 ? 'first' : 'digest';

  await db.insert(schema.notifications).values({
    userId: authorId,
    submissionId,
    kind,
    payload: event,
  });

  // 「即時」就要是即時的：不要讓第一封通知等到下一次排程才寄出去。
  // 失敗不影響互動本身，排程還會再撿一次
  if (kind === 'first') {
    void dispatchNotifications().catch(() => undefined);
  }
}
