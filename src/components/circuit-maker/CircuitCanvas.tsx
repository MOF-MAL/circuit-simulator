"use client";

/**
 * 回路メーカーエリアのキャンバス部分（今はまだプレースホルダー）。
 * 次のステップで @xyflow/react（React Flow）を組み込み、
 * ここに素子をドラッグ＆ドロップして配線できるようにする。
 */
export function CircuitCanvas() {
  return (
    <div
      className="h-full w-full overflow-auto bg-white dark:bg-slate-950"
      style={{
        // 方眼紙のようなドットの背景。キャンバスの位置感覚をつかみやすくするための飾り。
        backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
        backgroundSize: "20px 20px",
        color: "rgb(203 213 225)",
      }}
    >
      <div className="flex h-full items-center justify-center">
        <p className="rounded-md bg-white/80 px-3 py-1.5 text-xs text-slate-500 dark:bg-slate-950/80 dark:text-slate-400">
          回路メーカーエリア（キャンバス）
          <br />
          ここに @xyflow/react を使った回路図エディタが入ります
        </p>
      </div>
    </div>
  );
}
