"use client";

import { useNodes } from "@xyflow/react";
import { useState } from "react";
import type { CircuitElementNodeType } from "@/components/circuit-maker/nodes/CircuitElementNode";

type DataTab = "graph" | "table";

/**
 * 電流計・電圧計の測定値セクション（タブ切り替えに関係なく常時表示）。
 * まだMNA等の回路計算エンジンを実装していないため、値は "-" のプレースホルダー。
 * 計算エンジン実装後は、ここに実際の測定値を差し込むだけでよい。
 */
function MeasurementsSection() {
  const nodes = useNodes<CircuitElementNodeType>();
  const meters = nodes.filter(
    (node) =>
      node.data.elementType === "ammeter" ||
      node.data.elementType === "voltmeter",
  );

  if (meters.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-slate-200 px-2 py-1.5 text-xs dark:border-slate-800">
      <p className="mb-1 font-medium text-slate-500 dark:text-slate-400">
        測定値
      </p>
      <ul className="space-y-0.5">
        {meters.map((node) => (
          <li
            key={node.id}
            className="flex items-center justify-between text-slate-600 dark:text-slate-300"
          >
            <span>
              {node.data.elementType === "ammeter" ? "電流計" : "電圧計"} (ID:{" "}
              {node.id.slice(0, 8)})
            </span>
            <span>- {node.data.elementType === "ammeter" ? "A" : "V"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** グラフタブの中身（プレースホルダー） */
function GraphTabContent() {
  return (
    <div className="flex h-full items-center justify-center text-xs text-slate-400">
      グラフ表示エリア（後で mathjs の計算結果をここにプロットします）
    </div>
  );
}

/** テーブルタブの中身（プレースホルダーの表） */
function TableTabContent() {
  const rows = [
    { node: "ノード1", voltage: "-", current: "-" },
    { node: "ノード2", voltage: "-", current: "-" },
  ];

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-slate-300 text-left text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <th className="px-2 py-1 font-medium">ノード</th>
          <th className="px-2 py-1 font-medium">電位 (V)</th>
          <th className="px-2 py-1 font-medium">電流 (A)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.node}
            className="border-b border-slate-100 dark:border-slate-800"
          >
            <td className="px-2 py-1 text-slate-600 dark:text-slate-300">
              {row.node}
            </td>
            <td className="px-2 py-1 text-slate-600 dark:text-slate-300">
              {row.voltage}
            </td>
            <td className="px-2 py-1 text-slate-600 dark:text-slate-300">
              {row.current}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * 「回路データエリア」。
 * 回路上の任意の場所の電流・電位・電圧・抵抗などを、
 * 「グラフ」と「テーブル」のタブを切り替えて確認できるようにする。
 * 実際の数値計算（MNAの結果）はまだ繋がっていないため、今は空のプレースホルダー。
 */
export function DataArea() {
  const [activeTab, setActiveTab] = useState<DataTab>("table");

  return (
    <div className="flex h-full w-full flex-col overflow-auto">
      <p className="shrink-0 border-b border-slate-300 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        回路データエリア
      </p>

      <MeasurementsSection />

      {/* グラフ / テーブル のタブ切り替えボタン */}
      <div className="flex shrink-0 gap-1 border-b border-slate-200 px-2 pt-1.5 dark:border-slate-800">
        {(
          [
            { id: "graph", label: "グラフ" },
            { id: "table", label: "テーブル" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={
              activeTab === tab.id
                ? "rounded-t-md border border-b-0 border-slate-300 bg-white px-3 py-1 text-xs font-medium text-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-blue-400"
                : "rounded-t-md px-3 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-2">
        {activeTab === "graph" ? <GraphTabContent /> : <TableTabContent />}
      </div>
    </div>
  );
}
