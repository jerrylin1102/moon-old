import { useEffect } from 'react';
import { applyBlessing, applyDivination, applyVerdict } from '../actions';
import { useInteraction } from '../interactionStore';

/**
 * 桌機鍵盤快捷鍵。忙起來的時候滑鼠只夠用來選人，
 * 批示交給左手，不然一個人根本處理不完。
 */
export function useKeyboard(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const focused = useInteraction.getState().focusedId;

      switch (e.key) {
        case '1':
          applyVerdict(focused, 'approve');
          break;
        case '2':
          applyVerdict(focused, 'reject');
          break;
        case '3':
          applyVerdict(focused, 'transfer');
          break;
        case '4':
          applyDivination(focused, 'sheng');
          break;
        case '5':
          applyDivination(focused, 'xiao');
          break;
        case '6':
          applyDivination(focused, 'yin');
          break;
        case ' ':
          e.preventDefault();
          applyBlessing();
          break;
        case 'Escape':
          useInteraction.getState().focus(null);
          break;
        default:
          return;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
