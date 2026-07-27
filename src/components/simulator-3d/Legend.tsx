"use client";

import type { ReactNode } from "react";
import type { SimulationSnapshot } from "@/lib/circuit-solver/types";
import { powerGradientCss } from "./colorScale";

export type DisplayMode = "potential" | "current" | "power" | "info";

/**
 * モードごとの凡例。3D Canvasの外側(プレーンなDOM)に重ねて表示する
 * (WebGL側で文字を描くより軽量で、Tailwindのスタイルもそのまま使える)。
 * 電位・電流・電力はいずれも「これまで観測した最大値」を基準にした相対表示なので、
 * 具体的な最大値の数値は出さず、相対値であることだけを示す
 * (基準値はCanvas内の各モードコンポーネントが個別に保持しており、Canvas外のこの
 * コンポーネントからは参照できないため)。
 * 素子情報モードはラベル自体が説明になるので凡例は出さない。
 */
export function Legend({
  mode,
}: {
  mode: DisplayMode;
  snapshot: SimulationSnapshot | null;
}) {
  if (mode === "info") return null;

  let content: ReactNode = null;
  if (mode === "potential") {
    content = <span>高さ = 電位(相対値)</span>;
  } else if (mode === "current") {
    content = <span>粒子の速さ = 電流の大きさ(相対値)、向き = 電流の向き</span>;
  } else if (mode === "power") {
    content = (
      <div className="flex items-center gap-1.5">
        <span>発熱(消費電力、相対値)</span>
        <span
          className="h-2 w-16 rounded"
          style={{ background: powerGradientCss() }}
        />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute bottom-1 left-1 rounded bg-slate-800/80 px-2 py-1 text-[10px] text-slate-100">
      {content}
    </div>
  );
}
