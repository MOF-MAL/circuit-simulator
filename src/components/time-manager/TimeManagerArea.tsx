"use client";

import { useSimulation } from "@/components/simulation/SimulationProvider";

/**
 * 「タイムマネージャーUI」。
 * 回路の初期状態からの時間経過を再生・一時停止したり、
 * スライダーで好きな時刻に移動したりするための操作パネル。
 *
 * useSimulation()(SimulationProvider.tsx)から、実際のシミュレーション結果の
 * 再生位置・再生状態を取得して操作する。
 */
export function TimeManagerArea() {
  const {
    isPlaying,
    play,
    pause,
    currentTimeSec,
    cachedDurationSec,
    seek,
    errorReason,
  } = useSimulation();

  return (
    <div className="flex h-12 w-full shrink-0 items-center gap-3 border-t border-slate-300 bg-slate-100 px-3 dark:border-slate-700 dark:bg-slate-800">
      {/* 再生・一時停止の切り替えボタン */}
      <button
        type="button"
        onClick={() => (isPlaying ? pause() : play())}
        disabled={errorReason !== null}
        aria-label={isPlaying ? "一時停止" : "再生"}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40"
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

      {/*
        時間軸のスライダー: 保持しているデータの範囲に関わらず、常に0秒を基準に時刻を表す。
        保持済みの窓より前をシークした場合は、SimulationProvider側で時刻0から自動的に
        再計算される。
      */}
      <input
        type="range"
        min={0}
        max={cachedDurationSec}
        step={0.0001}
        value={currentTimeSec}
        onChange={(event) => seek(Number(event.target.value))}
        disabled={errorReason !== null}
        className="h-1.5 flex-1 accent-blue-500"
        aria-label="シミュレーション時刻"
      />

      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
        {errorReason
          ? "計算不可"
          : `t = ${(currentTimeSec * 1000).toFixed(2)} ms`}
      </span>
    </div>
  );
}
