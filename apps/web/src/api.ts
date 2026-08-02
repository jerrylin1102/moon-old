import { wishSchema, type GameMode, type PlaySessionInput, type Wish } from '@moon/shared';
import type { Me } from './authStore';

/**
 * 後端 client。
 *
 * 原則：後端是加分項，不是必需品。任何一支失敗都只是回 null 或空陣列，
 * 遊戲照樣跑——官方願望池已經打包進 bundle，離線可玩。
 */

const TIMEOUT_MS = 6000;

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      ...init,
      signal: controller.signal,
      // session 是 httpOnly cookie，每一支都要帶上才知道是誰
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 已核准的社群願望。拉不到就只用官方池 */
export async function fetchApprovedWishes(): Promise<Wish[]> {
  const data = await request<{ wishes: unknown[] }>('/api/wishes/approved');
  if (!data) return [];
  // 後端的資料一樣要驗證過才進池子
  return data.wishes.flatMap((raw) => {
    const parsed = wishSchema.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  });
}

/** 官方題庫（資料庫版）。拉不到就繼續用打包進 bundle 的 JSON 快照 */
export async function fetchWishBank(): Promise<Wish[]> {
  const data = await request<{ wishes: unknown[] }>('/api/wish-bank');
  if (!data) return [];
  return data.wishes.flatMap((raw) => {
    const parsed = wishSchema.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  });
}

export type SubmitResult =
  | { ok: true; message: string }
  | { ok: false; message: string }
  | { ok: false; offline: true; message: string };

export async function submitWish(text: string, category: string): Promise<SubmitResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('/api/wishes/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, category }),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string; issues?: string[] };

    if (res.status === 201) {
      return { ok: true, message: body.message ?? '送出了，已經在廟裡。' };
    }
    if (res.status === 429) {
      return { ok: false, message: '投稿太頻繁了，等一下再試。' };
    }
    if (res.status === 503) {
      return { ok: false, offline: true, message: '這個版本沒有接後端，投稿功能暫時關閉。' };
    }
    return {
      ok: false,
      message: body.message ?? body.issues?.[0] ?? '這則願望沒辦法收，換個寫法試試。',
    };
  } catch {
    return { ok: false, offline: true, message: '連不上伺服器，投稿功能暫時關閉。' };
  } finally {
    clearTimeout(timer);
  }
}

// --- 社群互動 ---

/** 回報玩家對某則社群願望做了什麼。失敗就算了，不影響遊戲 */
export function reportInteraction(submissionId: string, action: string, guestId?: string): void {
  void request('/api/interactions', {
    method: 'POST',
    body: JSON.stringify({ submissionId, action, guestId }),
  });
}

export interface WishComment {
  id: string;
  body: string;
  createdAt: string;
  author: { name: string; code: string };
  up: number;
  down: number;
}

export async function fetchComments(submissionId: string): Promise<WishComment[]> {
  const data = await request<{ comments: WishComment[] }>(`/api/wishes/${submissionId}/comments`);
  return data?.comments ?? [];
}

export type CommentResult = { ok: true } | { ok: false; message: string };

export async function postComment(submissionId: string, body: string): Promise<CommentResult> {
  try {
    const res = await fetch(`/api/wishes/${submissionId}/comments`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (res.status === 201) return { ok: true };
    if (res.status === 401) return { ok: false, message: '留言要先登入。' };
    const payload = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, message: payload.message ?? '這則留言沒辦法送出。' };
  } catch {
    return { ok: false, message: '連不上伺服器。' };
  }
}

export async function voteComment(commentId: string, value: 1 | -1): Promise<boolean> {
  const data = await request<{ ok: boolean }>(`/api/comments/${commentId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ value }),
  });
  return data?.ok === true;
}

export async function reportContent(
  targetType: 'comment' | 'wish',
  targetId: string,
  reason?: string,
): Promise<boolean> {
  const data = await request<{ ok: boolean }>('/api/reports', {
    method: 'POST',
    body: JSON.stringify({ targetType, targetId, reason }),
  });
  return data?.ok === true;
}

export async function submitAppeal(message: string): Promise<{ ok: boolean; message: string }> {
  const data = await request<{ ok: boolean; message: string }>('/api/appeals', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
  return data ?? { ok: false, message: '送不出去，等一下再試。' };
}

export interface MyWish {
  id: string;
  text: string;
  category: string;
  status: 'pending' | 'approved' | 'rejected';
  moderationNote: string | null;
  createdAt: string;
  /** 各種互動的次數，key 是 approve/reject/transfer/sheng/xiao/yin/thread/ignored */
  interactions: Record<string, number>;
  commentCount: number;
}

export async function fetchMyWishes(): Promise<{
  wishes: MyWish[];
  used: number;
  limit: number;
} | null> {
  return request<{ wishes: MyWish[]; used: number; limit: number }>('/api/wishes/mine');
}

export async function deleteWish(id: string): Promise<boolean> {
  const data = await request<{ ok: boolean }>(`/api/wishes/${id}`, { method: 'DELETE' });
  return data?.ok === true;
}

export interface ScoreRow {
  nickname: string;
  /** 暱稱可重複，靠這三碼分辨 */
  code: string;
  score: number;
  wishesHandled: number;
  matched: number;
  peakFatigue: number;
  title: string | null;
}

export async function fetchScores(mode: GameMode): Promise<ScoreRow[]> {
  const data = await request<{ scores: ScoreRow[] }>(`/api/scores?mode=${mode}`);
  return data?.scores ?? [];
}

export async function postScore(input: PlaySessionInput): Promise<boolean> {
  const data = await request<{ ok: boolean }>('/api/scores', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data?.ok === true;
}

// --- 帳號 ---

export async function fetchAuthConfig(): Promise<{ googleClientId: string | null }> {
  const data = await request<{ googleClientId: string | null }>('/api/auth/config');
  return { googleClientId: data?.googleClientId ?? null };
}

export async function fetchMe(): Promise<Me | null> {
  const data = await request<{ user: Me | null }>('/api/me');
  return data?.user ?? null;
}

/** 用 Google 的 ID token 換自己的 session cookie */
export async function loginWithGoogle(credential: string): Promise<Me | null> {
  const data = await request<{ user: Me }>('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  });
  return data?.user ?? null;
}

export async function logout(): Promise<void> {
  await request('/api/auth/logout', { method: 'POST' });
}

export async function updateMe(patch: {
  displayName?: string;
  emailOptIn?: boolean;
  introSeen?: boolean;
}): Promise<Me | null> {
  const data = await request<{ user: Me }>('/api/me', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return data?.user ?? null;
}

/** 稀有信眾。拿不到就回 null，呼叫端安靜地用預寫池頂上 */
export async function fetchRareWish(): Promise<Wish | null> {
  const data = await request<{ wish: unknown }>('/api/blessing/rare', { method: 'POST' });
  if (!data) return null;
  const parsed = wishSchema.safeParse(data.wish);
  return parsed.success ? parsed.data : null;
}
