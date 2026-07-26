import { useGame } from '../gameStore';

const TONE_CLASS = {
  good: 'border-l-[3px] border-l-[#7fae6d] text-incense/85',
  bad: 'border-l-[3px] border-l-[#c9414b] text-incense/85',
  neutral: 'border-l-[3px] border-l-incense/35 text-incense/70',
} as const;

/** 批示之後的後果。這裡是玩家唯一看得到「自己做了什麼」的地方 */
export function Outcomes() {
  useGame((s) => s.version);
  const outcomes = useGame.getState().state?.outcomes ?? [];
  if (outcomes.length === 0) return null;

  return (
    <div className="pointer-events-none absolute left-3 top-24 w-64 space-y-1.5 sm:left-4 sm:top-28 sm:w-72">
      {outcomes.map((o) => (
        <p
          key={o.id}
          className={`rounded-r bg-black/55 py-1.5 pl-2.5 pr-2 text-[12px] leading-snug ${TONE_CLASS[o.tone]}`}
          style={{ opacity: Math.min(1, o.ttl / 1.2) }}
        >
          {o.text}
        </p>
      ))}
    </div>
  );
}
