"use client";

import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import { TimeManagerArea } from "@/components/time-manager/TimeManagerArea";
import { type DisplayMode, Legend } from "./Legend";
import { Scene3D } from "./Scene3D";

/** モード切り替えボタンの並び順・ラベル */
const DISPLAY_MODE_OPTIONS: { id: DisplayMode; label: string }[] = [
  { id: "potential", label: "電位" },
  { id: "current", label: "電流" },
  { id: "power", label: "電力" },
  { id: "info", label: "素子情報" },
];

/**
 * 「回路シミュレータエリア」（3Dビュー）。
 * @react-three/fiber の Canvas に、回路のレイアウトと選択中の表示モードを渡して描画する。
 *
 * タイムマネージャーUI（再生ボタン＋スライダー）は、独立したリサイズ領域にはせず、
 * このエリアの一部としていちばん下に固定表示している
 * （手書きレイアウトで、3Dビューのすぐ下に配置されていたため）。
 */
export function Simulator3DArea() {
  const [mode, setMode] = useState<DisplayMode>("potential");
  const { currentSnapshot } = useSimulation();

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-300 bg-slate-100 px-2 py-1 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
          回路シミュレータエリア（3Dビュー）
        </p>
        <div className="flex gap-1">
          {DISPLAY_MODE_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={
                mode === id
                  ? "rounded bg-blue-500 px-2 py-0.5 text-[10px] text-white"
                  : "rounded bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-white">
        <Canvas>
          <Scene3D mode={mode} />
        </Canvas>
        <Legend mode={mode} snapshot={currentSnapshot} />
      </div>

      {/* タイムマネージャーUI: 3Dビューエリアの下部に固定の帯として配置 */}
      <TimeManagerArea />
    </div>
  );
}
