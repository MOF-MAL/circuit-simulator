"use client";

import {
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

type Point = { x: number; y: number };

/** rechartsに渡す前に間引く目安の最大点数(滑らかさは十分保ちつつ描画コストを抑える) */
const MAX_PLOTTED_POINTS = 300;

/** 点群を、一定数以下になるまで一定間隔で間引く(最後の点は必ず含める) */
function downsample(points: Point[]): Point[] {
  if (points.length <= MAX_PLOTTED_POINTS) return points;
  const step = Math.ceil(points.length / MAX_PLOTTED_POINTS);
  const sampled = points.filter((_, i) => i % step === 0);
  const last = points[points.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

/**
 * 時刻(x, 秒)と値(y)の折れ線グラフ(recharts製の薄いラッパー)。
 *
 * x軸のdomainは、実データの範囲(dataMin/dataMax)ではなく、呼び出し側から明示的に渡された
 * [開始時刻, 終了時刻]を使う。SimulationProviderのスライド窓は毎フレーム一定量ずつ滑らかに
 * 動くので、その値をそのまま渡すことで、描画範囲(軸の数字)もカクつかず滑らかに移動する。
 */
export function LineChart({
  points,
  domain,
  unit,
  color,
}: {
  points: Point[];
  /** X軸(時刻・秒)の表示範囲。SimulationProviderの[windowStartSec, cachedDurationSec]を渡す。 */
  domain: [number, number];
  unit: string;
  color: string;
}) {
  if (points.length === 0) {
    return (
      <div className="flex h-28 items-center justify-center text-xs text-slate-400">
        データがありません
      </div>
    );
  }

  const sampled = downsample(points);

  return (
    <div className="h-28 w-full text-xs text-slate-500 dark:text-slate-400">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart
          data={sampled}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        >
          <XAxis
            dataKey="x"
            type="number"
            domain={domain}
            allowDataOverflow
            tickFormatter={(value: number) => `${(value * 1000).toFixed(1)}ms`}
            fontSize={10}
            stroke="currentColor"
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={(value: number) => value.toFixed(2)}
            width={48}
            fontSize={10}
            stroke="currentColor"
            unit={unit}
          />
          <Line
            type="monotone"
            dataKey="y"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
