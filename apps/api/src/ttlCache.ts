interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

/**
 * 極簡記憶體 TTL 快取。很多玩家同時開局都會打同一支熱門 GET（例如已核准願望列表），
 * 內容變動不頻繁，快取幾十秒可以大幅降低併發開局時的 DB 壓力。
 *
 * 沒有跨 process 共享——多個 API replica 各自快取一份，正確性影響有限
 * （最多多等一個 TTL 週期才看到剛審核的內容），寫入路徑會主動 `invalidate()`
 * 把這個延遲壓到幾乎為零。
 */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) return hit.value as T;

  const value = await load();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/** 內容被寫入（投稿、審核、下架……）之後呼叫，不用等 TTL 自然過期 */
export function invalidate(key: string): void {
  store.delete(key);
}
