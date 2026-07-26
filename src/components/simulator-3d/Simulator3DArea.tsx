"use client";

import { TimeManagerArea } from "@/components/time-manager/TimeManagerArea";

/**
 * 表示モード切り替えボタンのモック（電位・電流など）。
 * 実際の3Dビューと連動させるのは、@react-three/fiber を組み込む次のステップで行う。
 */
const DISPLAY_MODES = ["電位", "電流", "抵抗"] as const;

/**
 * 「回路シミュレータエリア」（3Dビュー）。
 * 今はまだ @react-three/fiber の Canvas を組み込んでいないプレースホルダー。
 *
 * タイムマネージャーUI（再生ボタン＋スライダー）は、独立したリサイズ領域にはせず、
 * このエリアの一部としていちばん下に固定表示している
 * （手書きレイアウトで、3Dビューのすぐ下に配置されていたため）。
 */
export function Simulator3DArea() {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-300 bg-slate-100 px-2 py-1 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
          回路シミュレータエリア（3Dビュー）
        </p>
        <div className="flex gap-1">
          {DISPLAY_MODES.map((mode, index) => (
            <button
              key={mode}
              type="button"
              // モックアップ段階では未実装。最初のモードだけ選択中の見た目にしている。
              disabled
              className={
                index === 0
                  ? "rounded bg-blue-500 px-2 py-0.5 text-[10px] text-white disabled:opacity-90"
                  : "rounded bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600 disabled:opacity-60 dark:bg-slate-700 dark:text-slate-300"
              }
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-900">
        <p className="rounded-md bg-slate-800/80 px-3 py-1.5 text-center text-xs text-slate-300">
          3Dビューエリア
          <br />
          ここに @react-three/fiber を使った3D回路表示が入ります
          <br />
          （マウスドラッグでの視点操作にも対応予定）
        </p>
      </div>

      {/* タイムマネージャーUI: 3Dビューエリアの下部に固定の帯として配置 */}
      <TimeManagerArea />
    </div>
  );
}
