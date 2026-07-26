"use client";

import { Separator } from "./resizable-panels";

type PanelSeparatorProps = {
  /**
   * このセパレーターの親 Group がどちら向きに Panel を並べているか。
   * "horizontal" = Panel が左右に並ぶ（セパレーターは縦線・左右ドラッグ）
   * "vertical"   = Panel が上下に並ぶ（セパレーターは横線・上下ドラッグ）
   */
  parentGroupOrientation: "horizontal" | "vertical";
};

/**
 * 画面の各エリアの境界線（ドラッグでリサイズ・折りたたみができる部分）。
 * 見た目を統一するために、react-resizable-panels の Separator をラップしている。
 */
export function PanelSeparator({
  parentGroupOrientation,
}: PanelSeparatorProps) {
  const isVerticalLine = parentGroupOrientation === "horizontal";

  return (
    <Separator
      className={
        isVerticalLine
          ? "group relative w-1.5 shrink-0 cursor-col-resize touch-none bg-slate-300 transition-colors hover:bg-blue-400 dark:bg-slate-700"
          : "group relative h-1.5 shrink-0 cursor-row-resize touch-none bg-slate-300 transition-colors hover:bg-blue-400 dark:bg-slate-700"
      }
    >
      {/* ここがドラッグ可能であることを示すための、つまみ（グリップ）の見た目 */}
      <span
        aria-hidden
        className={
          isVerticalLine
            ? "pointer-events-none absolute top-1/2 left-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400 group-hover:bg-blue-100"
            : "pointer-events-none absolute top-1/2 left-1/2 h-1 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400 group-hover:bg-blue-100"
        }
      />
    </Separator>
  );
}
