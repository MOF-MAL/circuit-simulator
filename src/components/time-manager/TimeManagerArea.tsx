"use client";

import { useState } from "react";

/**
 * 「タイムマネージャーUI」。
 * 回路の初期状態からの時間経過を再生・一時停止したり、
 * スライダーで好きな時刻に移動したりするための操作パネル。
 *
 * このモックアップの段階では、実際のシミュレーション時間とは連動しておらず、
 * 再生ボタンの見た目が切り替わるだけ。
 * 後のステップで、時間ステップ Δt ごとのMNA計算結果と接続する。
 */
export function TimeManagerArea() {
  // 再生中かどうか（見た目だけの状態。実際のシミュレーションはまだ動いていない）
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="flex h-full w-full items-center gap-3 border-t border-slate-300 bg-slate-100 px-3 dark:border-slate-700 dark:bg-slate-800">
      {/* 再生・一時停止の切り替えボタン */}
      <button
        type="button"
        onClick={() => setIsPlaying((current) => !current)}
        aria-label={isPlaying ? "一時停止" : "再生"}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600"
      >
        {isPlaying ? (
          // 一時停止アイコン（縦棒2本）
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="currentColor"
            role="img"
            aria-hidden
          >
            <title>一時停止アイコン</title>
            <rect x="6" y="5" width="4" height="14" />
            <rect x="14" y="5" width="4" height="14" />
          </svg>
        ) : (
          // 再生アイコン（三角形）
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="currentColor"
            role="img"
            aria-hidden
          >
            <title>再生アイコン</title>
            <path d="M7 5l12 7-12 7z" />
          </svg>
        )}
      </button>

      {/* 時間軸のスライダー（現時点では見た目のみで、実際の時刻とは未連動） */}
      <input
        type="range"
        min={0}
        max={100}
        defaultValue={0}
        className="h-1.5 flex-1 accent-blue-500"
        aria-label="シミュレーション時刻"
      />

      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
        t = 0.00 s
      </span>
    </div>
  );
}
