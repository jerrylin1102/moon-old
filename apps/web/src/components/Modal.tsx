import { useEffect, type ReactNode } from 'react';

/** 共用浮動視窗：點背景或按 Esc 關閉 */
export function Modal({
  title,
  onClose,
  children,
  width = 'max-w-sm',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full ${width} rounded-xl border border-temple-gold/35 bg-[#160c0d] p-5 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-xl tracking-widest text-temple-gold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-incense/40 transition hover:text-incense/80"
          >
            關閉
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
