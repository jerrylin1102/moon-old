import { useEffect, useState } from 'react';
import { fetchComments, reportContent, voteComment, type WishComment } from '../api';

/**
 * 某則願望底下的留言。
 *
 * 讚與倒讚目前只寫進資料庫，不影響排序或任何顯示以外的行為——
 * 這是刻意的：先收集訊號，再決定要不要用它。
 */
export function CommentList({ submissionId }: { submissionId: string }) {
  const [comments, setComments] = useState<WishComment[] | null>(null);
  const [voted, setVoted] = useState<Record<string, 1 | -1>>({});
  const [reported, setReported] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    void fetchComments(submissionId).then((c) => alive && setComments(c));
    return () => {
      alive = false;
    };
  }, [submissionId]);

  if (!comments || comments.length === 0) return null;

  const vote = async (id: string, value: 1 | -1) => {
    setVoted((v) => ({ ...v, [id]: value }));
    await voteComment(id, value);
  };

  const report = async (id: string) => {
    setReported((r) => ({ ...r, [id]: true }));
    await reportContent('comment', id);
  };

  return (
    <ul className="mt-3 space-y-2">
      {comments.map((c) => (
        <li key={c.id} className="rounded-md bg-white/5 px-3 py-2">
          <div className="flex items-baseline gap-2 text-[11px] text-incense/45">
            <span className="text-incense/70">{c.author.name}</span>
            <span className="text-incense/25">#{c.author.code}</span>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-incense/85">{c.body}</p>

          <div className="mt-2 flex items-center gap-3 text-[11px]">
            <button
              type="button"
              onClick={() => vote(c.id, 1)}
              className={`transition ${voted[c.id] === 1 ? 'text-[#9ac47f]' : 'text-incense/40 hover:text-incense/80'}`}
            >
              讚 {c.up + (voted[c.id] === 1 ? 1 : 0)}
            </button>
            <button
              type="button"
              onClick={() => vote(c.id, -1)}
              className={`transition ${voted[c.id] === -1 ? 'text-[#d98a8a]' : 'text-incense/40 hover:text-incense/80'}`}
            >
              倒讚 {c.down + (voted[c.id] === -1 ? 1 : 0)}
            </button>
            <button
              type="button"
              disabled={reported[c.id]}
              onClick={() => report(c.id)}
              className="ml-auto text-incense/35 transition hover:text-[#d98a8a] disabled:opacity-40"
            >
              {reported[c.id] ? '已檢舉' : '檢舉'}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
