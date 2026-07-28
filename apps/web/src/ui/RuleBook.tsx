import type { WishCategory } from '@moon/shared';
import { useGame } from '../gameStore';
import { Modal } from '../components/Modal';
import { CATEGORY_LABEL } from '../sim/rulebook';

const CATEGORY_ORDER: WishCategory[] = [
  'love',
  'health',
  'money',
  'exam',
  'revenge',
  'ticket',
  'absurd',
];

/** 最近幾秒內更新過的公文才標「剛更新」，免得整場都在閃 */
const RECENT_WINDOW = 10;

/** 模式 C 的業務範圍規則書：玩家判斷准／轉單的唯一依據，但它可能被公文改得跟現實不一樣 */
export function RuleBook({ onClose }: { onClose: () => void }) {
  useGame((s) => s.version);
  const state = useGame.getState().state;
  if (!state) return null;

  const recentCategories = new Set(
    state.rulebookLog.filter((l) => state.elapsed - l.at < RECENT_WINDOW).map((l) => l.text),
  );

  return (
    <Modal title="業務範圍規則書" onClose={onClose} width="max-w-lg">
      <p className="text-xs leading-relaxed text-incense/60">
        以下是目前公告的受理範圍。規則書中途會收到公文更新，更新之後這裡會馬上跟著改——
        但改了不代表信眾的實際情況也跟著變，判斷還是要聽他們怎麼說。
      </p>

      <ul className="mt-4 space-y-2">
        {CATEGORY_ORDER.map((cat) => {
          const inScope = state.rulebook[cat];
          return (
            <li
              key={cat}
              className="flex items-center justify-between rounded-lg border border-incense/15 bg-black/30 px-3 py-2"
            >
              <span className="font-serif text-sm text-incense">{CATEGORY_LABEL[cat]}</span>
              <span
                className={`rounded-full px-3 py-1 text-xs ${
                  inScope
                    ? 'bg-temple-red/40 text-incense'
                    : 'border border-temple-gold/40 text-temple-gold/80'
                }`}
              >
                {inScope ? '月老親自受理' : '應轉單'}
              </span>
            </li>
          );
        })}
      </ul>

      {state.rulebookLog.length > 0 && (
        <div className="mt-5 border-t border-incense/10 pt-3">
          <h3 className="text-xs tracking-widest text-incense/50">今日公文</h3>
          <ul className="mt-2 space-y-1.5">
            {state.rulebookLog.map((log, i) => (
              <li key={i} className="text-[11px] leading-relaxed text-incense/60">
                {recentCategories.has(log.text) && (
                  <span className="mr-1 text-temple-gold/80">〔剛更新〕</span>
                )}
                {log.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.pendingMemos.length > 0 && (
        <p className="mt-3 text-[11px] text-incense/40">
          還有 {state.pendingMemos.length} 份公文尚未發出。
        </p>
      )}
    </Modal>
  );
}
