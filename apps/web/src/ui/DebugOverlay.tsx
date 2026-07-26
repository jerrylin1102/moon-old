import { useDebug } from '../debug';

/** 只在 dev 模式顯示：對照效能預算（draw call < 100、60fps） */
export function DebugOverlay() {
  const { fps, drawCalls, triangles } = useDebug();

  return (
    <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 font-mono text-[10px] leading-tight text-incense/60">
      <div>{fps} fps</div>
      <div>{drawCalls} calls</div>
      <div>{(triangles / 1000).toFixed(1)}k tris</div>
    </div>
  );
}
