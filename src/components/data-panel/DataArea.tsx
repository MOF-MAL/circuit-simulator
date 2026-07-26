"use client";

import { useState } from "react";

type DataTab = "graph" | "table";

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
