"use client";

import { useNodes, useReactFlow } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CIRCUIT_ELEMENT_TYPES,
  type CircuitElementType,
  createDefaultParams,
  elementTypeLabel,
} from "./circuit-elements";
import type { CircuitElementNodeType } from "./nodes/CircuitElementNode";
import { ToolboxItemPreview } from "./ToolboxItemPreview";

/** ドラッグとみなす前に許容する、押した位置からの移動量(px未満はまだ「クリック」の可能性を残す) */
const DRAG_THRESHOLD_PX = 4;

type DragTracking = {
  elementType: CircuitElementType;
  startX: number;
  startY: number;
  x: number;
  y: number;
  dragging: boolean;
};

/**
 * 回路メーカーエリアの左側に配置する、回路素子のパレット（ツールボックス）。
 * 各素子は回路メーカーエリアに配置したときと同じ見た目(ToolboxItemPreview)で表示し、
 * ここからドラッグして、右側のキャンバス（CircuitCanvas）に配置できる。
 * ドラッグせずクリックしただけの場合は、キャンバスの適当な位置に配置する。
 *
 * ドラッグはネイティブHTML5 D&Dではなく、素のポインタイベント(pointermove/pointerup)+
 * フローティングプレビューによる自前実装にしている。これにより、ブラウザ既定の
 * (半透明でぼやけた)ドラッグゴーストにならず、Scratchのように同じ見た目のまま
 * カーソルに追従する操作感になる。
 */
export function Toolbox() {
  const { getNodes, setNodes, screenToFlowPosition } =
    useReactFlow<CircuitElementNodeType>();
  // 素子の種類ごとの上限(maxCount、例:アースは1個まで)チェックのため、
  // ノード数の変化を購読して再レンダリングされるようにする
  const nodes = useNodes<CircuitElementNodeType>();

  // フローティングプレビュー表示用のstate(ドラッグとみなされた時だけ非null)。
  // 実際の追跡はイベントハンドラ内で完結させたいのでrefにも同じ内容を持つ。
  const [drag, setDrag] = useState<DragTracking | null>(null);
  const dragRef = useRef<DragTracking | null>(null);

  const placeOnCanvas = useCallback(
    (elementType: CircuitElementType, position?: { x: number; y: number }) => {
      // 何度もクリックしたときに完全に重ならないよう、既存ノード数から少しずつ位置をずらす
      // (ドラッグで明示的な位置が指定された場合はそちらを使う)
      const n = getNodes().length;
      const finalPosition = position ?? {
        x: 100 + (n % 6) * 60,
        y: 100 + Math.floor(n / 6) * 60,
      };
      setNodes((currentNodes) => [
        ...currentNodes.map((node) => ({ ...node, selected: false })),
        {
          id: crypto.randomUUID(),
          type: "circuitElement" as const,
          position: finalPosition,
          data: {
            elementType,
            name: elementTypeLabel(elementType),
            rotation: 0 as const,
            params: createDefaultParams(elementType),
          },
          selected: true,
        },
      ]);
    },
    [getNodes, setNodes],
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const tracking = dragRef.current;
      if (!tracking) return;
      const dx = event.clientX - tracking.startX;
      const dy = event.clientY - tracking.startY;
      const nowDragging =
        tracking.dragging ||
        Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;
      const next: DragTracking = {
        ...tracking,
        x: event.clientX,
        y: event.clientY,
        dragging: nowDragging,
      };
      dragRef.current = next;
      // 移動量が閾値を超えてドラッグとみなされるまでは、フローティングプレビューを
      // 出さない(単純なクリックの場合に一瞬アイコンが浮いて見えるのを防ぐため)
      if (nowDragging) setDrag(next);
    };

    const onPointerUp = (event: PointerEvent) => {
      const tracking = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!tracking?.dragging) return;
      // 離した位置がキャンバス本体(react-flowのpane)上かどうかで配置を判定する
      const droppedOnCanvas = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest(".react-flow__pane");
      if (!droppedOnCanvas) return;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      placeOnCanvas(tracking.elementType, position);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [placeOnCanvas, screenToFlowPosition]);

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
            onPointerDown={(event) => {
              if (limitReached) return;
              dragRef.current = {
                elementType: item.id,
                startX: event.clientX,
                startY: event.clientY,
                x: event.clientX,
                y: event.clientY,
                dragging: false,
              };
            }}
            // ドラッグせずクリックだけした場合はキャンバスに配置する
            // (実際にドラッグとして扱われた場合、離した場所が元のボタンでなければ
            //  ブラウザはclickイベントを発火しないため、下のドラッグ処理と競合しない)
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
            <ToolboxItemPreview elementType={item.id} />
            <span>{item.label}</span>
          </button>
        );
      })}

      {drag &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50"
            style={{
              left: drag.x,
              top: drag.y,
              transform: "translate(-50%, -50%)",
            }}
          >
            <ToolboxItemPreview elementType={drag.elementType} />
          </div>,
          document.body,
        )}
    </div>
  );
}
