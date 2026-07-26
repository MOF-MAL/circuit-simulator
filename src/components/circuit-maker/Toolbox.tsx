"use client";

import { useNodes, useReactFlow } from "@xyflow/react";
import { CircuitElementIcon } from "./CircuitElementIcon";
import {
  CIRCUIT_ELEMENT_DRAG_DATA_KEY,
  CIRCUIT_ELEMENT_TYPES,
  createDefaultParams,
} from "./circuit-elements";
import type { CircuitElementNodeType } from "./nodes/CircuitElementNode";

/**
 * 回路メーカーエリアの左側に配置する、回路素子のパレット（ツールボックス）。
 * ここから素子をドラッグして、右側のキャンバス（CircuitCanvas）に配置できる。
 * ドラッグせずクリックしただけの場合は、キャンバスの適当な位置に配置する。
 */
export function Toolbox() {
  // AppShell.tsxで引き上げ済みのReactFlowProviderの子孫なので、ここからも操作できる
  const { getNodes, setNodes } = useReactFlow<CircuitElementNodeType>();
  // 素子の種類ごとの上限(maxCount、例:アースは1個まで)チェックのため、
  // ノード数の変化を購読して再レンダリングされるようにする
  const nodes = useNodes<CircuitElementNodeType>();

  const placeOnCanvas = (
    elementType: (typeof CIRCUIT_ELEMENT_TYPES)[number]["id"],
  ) => {
    // 何度もクリックしたときに完全に重ならないよう、既存ノード数から少しずつ位置をずらす
    const n = getNodes().length;
    setNodes((currentNodes) => [
      ...currentNodes.map((node) => ({ ...node, selected: false })),
      {
        id: crypto.randomUUID(),
        type: "circuitElement" as const,
        position: { x: 100 + (n % 6) * 60, y: 100 + Math.floor(n / 6) * 60 },
        data: {
          elementType,
          rotation: 0 as const,
          params: createDefaultParams(elementType),
        },
        selected: true,
      },
    ]);
  };

  return (
    <div
      // data-toolbox-dropzone: キャンバス上の素子をここへドラッグして離すと削除できるようにするための目印
      data-toolbox-dropzone
      className="flex h-full w-full flex-col gap-1 overflow-y-auto border-r border-slate-300 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-900/40"
    >
      {CIRCUIT_ELEMENT_TYPES.map((item) => {
        // maxCountが設定されている素子(アースなど)は、既にその上限数だけ
        // キャンバスに存在する場合、これ以上配置できないようにする
        const currentCount = nodes.filter(
          (node) => node.data.elementType === item.id,
        ).length;
        const limitReached =
          item.maxCount !== undefined && currentCount >= item.maxCount;

        return (
          <button
            key={item.id}
            type="button"
            draggable={!limitReached}
            // ドラッグを開始したときに、「どの種類の素子か」を dataTransfer に載せる。
            // キャンバス側（CircuitCanvas）の onDrop で、このデータを読み取ってノードを追加する。
            onDragStart={(event) => {
              event.dataTransfer.setData(
                CIRCUIT_ELEMENT_DRAG_DATA_KEY,
                item.id,
              );
              event.dataTransfer.effectAllowed = "move";
            }}
            // ドラッグせずクリックだけした場合はキャンバスに配置する
            // (実際にドラッグ操作が発生した場合、ブラウザはclickイベントを発火しないため
            //  onDragStartと競合しない)
            onClick={limitReached ? undefined : () => placeOnCanvas(item.id)}
            disabled={limitReached}
            className={
              limitReached
                ? "flex cursor-not-allowed flex-col items-center gap-1 rounded-md border border-transparent p-1.5 text-[10px] leading-tight text-slate-400 opacity-40 dark:text-slate-600"
                : "flex flex-col items-center gap-1 rounded-md border border-transparent p-1.5 text-[10px] leading-tight text-slate-600 hover:border-slate-300 hover:bg-white dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            }
            title={
              limitReached
                ? `${item.label}は既に配置済みです(上限${item.maxCount}個)`
                : item.label
            }
          >
            <CircuitElementIcon elementId={item.id} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
