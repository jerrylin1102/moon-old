import { useGame } from '../gameStore';
import { useSession } from '../store';
import { DIFFICULTY_PRESETS } from '../sim/state';
import { useInteraction } from '../interactionStore';
import { applyBlessing, applyVerdict } from '../actions';
import { BLESSING_COST } from '../sim/verdict';
import { useKeyboard } from './useKeyboard';
import { useRareWishes } from './useRareWishes';
import { VerdictBar } from './VerdictBar';
import { Outcomes } from './Outcomes';
import { RunEnded } from './RunEnded';
import { onCooldown } from '../sim/fatigue';

function Meter({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: string;
}) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="w-20 sm:w-32">
      <div className="flex justify-between text-[11px] tracking-widest text-incense/70">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full transition-[width] duration-150" style={{ width: `${pct}%`, background: tone }} />
      </div>
    </div>
  );
}

export function Hud() {
  // version 變動（約 10Hz）才重繪，實際數值從可變的 state 物件直接讀
  useGame((s) => s.version);
  const state = useGame.getState().state;
  const setPhase = useSession((s) => s.setPhase);
  const endGame = useGame((s) => s.end);
  const focusedId = useInteraction((s) => s.focusedId);
  const aiRareEnabled = useSession((s) => s.aiRareEnabled);
  useKeyboard(true);
  useRareWishes(aiRareEnabled);

  if (!state) return null;
  const cap = DIFFICULTY_PRESETS[state.difficulty].resentmentCap;
  const remaining = Math.max(0, state.dayLength - state.elapsed);
  const canBless = state.incense >= BLESSING_COST;
  const cooling = onCooldown(state);
  const nearCollapse = state.resentment / cap > 0.75;
  const ended = state.status !== 'running';

  const leave = () => {
    endGame();
    useInteraction.getState().reset();
    setPhase('prepare');
  };

  return (
    <>
      {/* 左上：三條資源 */}
      <div className="pointer-events-none absolute left-3 top-3 flex gap-2 sm:left-4 sm:top-4 sm:gap-4">
        <Meter label="香火" value={state.incense} max={100} tone="#d9a441" />
        <Meter label="疲勞" value={state.fatigue} max={100} tone="#7fa7c4" />
        <div className={nearCollapse ? 'animate-pulse' : undefined}>
          <Meter label="怨氣" value={state.resentment} max={cap} tone="#a3364a" />
        </div>
      </div>

      {/* 右上：時間與收工。手機上移到第二行，避免和資源條擠在一起 */}
      <div className="absolute right-3 top-14 flex items-center gap-3 sm:right-4 sm:top-4 sm:gap-4">
        {state.dayLength > 0 && (
          <span className="font-serif text-sm tracking-widest text-incense/75">
            打烊倒數 {Math.floor(remaining / 60)}:{String(Math.floor(remaining % 60)).padStart(2, '0')}
          </span>
        )}
        <button
          type="button"
          onClick={leave}
          className="rounded-full border border-incense/25 px-4 py-1.5 text-xs text-incense/70 transition hover:border-incense/50"
        >
          收工
        </button>
      </div>

      {/* 人流計數 */}
      <div className="pointer-events-none absolute left-3 top-14 flex gap-4 font-serif text-[11px] tracking-widest text-incense/60 sm:left-4 sm:top-16">
        <span>廟內 {state.worshippers.length}</span>
        <span>已處理 {state.handled}</span>
        <span className={state.ignored > 0 ? 'text-[#d98a8a]' : undefined}>
          忽略 {state.ignored}
        </span>
      </div>

      {/* 操作提示。選了人之後就交給批示條，這裡不再囉唆 */}
      {!focusedId && !ended && (
        <div className="pointer-events-none absolute left-1/2 bottom-28 -translate-x-1/2 text-center text-xs leading-relaxed text-incense/45 sm:bottom-10">
          <span className="hidden sm:inline">
            滑鼠環視廟內，點信眾聽願望。1 准 2 駁 3 轉單 4/5/6 擲筊，空白鍵神通。
          </span>
          <span className="sm:hidden">拖移畫面環視，點信眾聽願望。</span>
        </div>
      )}

      {!ended && <VerdictBar />}
      {!ended && <Outcomes />}
      <RunEnded />

      {/* 手機的四顆大按鈕：拇指可及範圍內 */}
      <div
        className={`absolute inset-x-4 bottom-6 flex justify-between sm:hidden ${ended ? 'hidden' : ''}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {(
          [
            { label: '准', run: () => applyVerdict(focusedId, 'approve'), needsFocus: true },
            { label: '駁', run: () => applyVerdict(focusedId, 'reject'), needsFocus: true },
            { label: '轉單', run: () => applyVerdict(focusedId, 'transfer'), needsFocus: true },
            { label: '神通', run: () => applyBlessing(), needsFocus: false },
          ] as const
        ).map((b) => {
          const disabled = b.needsFocus ? !focusedId || cooling : !canBless;
          return (
            <button
              key={b.label}
              type="button"
              disabled={disabled}
              onClick={b.run}
              className={`h-16 w-16 shrink-0 rounded-full border font-serif text-lg transition active:scale-95 ${
                disabled
                  ? 'border-incense/15 bg-black/40 text-incense/25'
                  : 'border-temple-gold/50 bg-temple-red/45 text-incense'
              }`}
            >
              {b.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
