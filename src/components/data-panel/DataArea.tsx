"use client";

import { useNodes } from "@xyflow/react";
import { useState } from "react";
import {
  CIRCUIT_ELEMENT_TYPES,
  type CircuitElementType,
} from "@/components/circuit-maker/circuit-elements";
import type { CircuitElementNodeType } from "@/components/circuit-maker/nodes/CircuitElementNode";
import { useSimulation } from "@/components/simulation/SimulationProvider";

type DataTab = "graph" | "table";

/** 素子の種類のID(例: "resistor")から、日本語ラベル(例: "抵抗")を逆引きする */
function elementLabel(elementType: CircuitElementType): string {
  const found = CIRCUIT_ELEMENT_TYPES.find((type) => type.id === elementType);
  return found ? found.label : elementType;
}

/** 数値を小数第3位までの文字列にする。値が定義されていない場合は"-"にする。 */
function formatValue(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value)
    ? "-"
    : value.toFixed(3);
}

/**
 * 電流計・電圧計の測定値セクション（タブ切り替えに関係なく常時表示）。
 * useSimulation()の現在の再生時刻におけるシミュレーション結果から実際の値を表示する。
 */
function MeasurementsSection() {
  const nodes = useNodes<CircuitElementNodeType>();
  const { currentSnapshot, errorReason } = useSimulation();
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
        {meters.map((node) => {
          const isAmmeter = node.data.elementType === "ammeter";
          const value = errorReason
            ? undefined
            : isAmmeter
              ? currentSnapshot?.elementCurrents[node.id]
              : currentSnapshot?.elementVoltages[node.id];
          return (
            <li
              key={node.id}
              className="flex items-center justify-between text-slate-600 dark:text-slate-300"
            >
              <span>
                {isAmmeter ? "電流計" : "電圧計"} (ID: {node.id.slice(0, 8)})
              </span>
              <span>
                {formatValue(value)} {isAmmeter ? "A" : "V"}
              </span>
            </li>
          );
        })}
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

/**
 * テーブルタブの中身。
 * useSimulation()の現在の再生時刻のシミュレーション結果から、
 * 各素子の電圧・電流を一覧表示する（アース自体は電圧・電流の概念を持たないため除く）。
 */
function TableTabContent() {
  const nodes = useNodes<CircuitElementNodeType>();
  const { currentSnapshot, errorReason } = useSimulation();

  if (errorReason) {
    return (
      <p className="px-2 py-3 text-xs text-red-500">
        計算できません: {errorReason}
      </p>
    );
  }

  const rows = nodes.filter((node) => node.data.elementType !== "ground");

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-slate-300 text-left text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <th className="px-2 py-1 font-medium">素子</th>
          <th className="px-2 py-1 font-medium">電圧 (V)</th>
          <th className="px-2 py-1 font-medium">電流 (A)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((node) => (
          <tr
            key={node.id}
            className="border-b border-slate-100 dark:border-slate-800"
          >
            <td className="px-2 py-1 text-slate-600 dark:text-slate-300">
              {elementLabel(node.data.elementType)}
            </td>
            <td className="px-2 py-1 text-slate-600 dark:text-slate-300">
              {formatValue(currentSnapshot?.elementVoltages[node.id])}
            </td>
            <td className="px-2 py-1 text-slate-600 dark:text-slate-300">
              {formatValue(currentSnapshot?.elementCurrents[node.id])}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * 「回路データエリア」。
 * 回路上の各素子の電圧・電流を、「グラフ」と「テーブル」のタブを切り替えて確認できる。
 * 実際の値は SimulationProvider(後退オイラー法によるMNA計算)から取得する。
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
