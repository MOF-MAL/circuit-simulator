"use client";

import { Position } from "@xyflow/react";
import type { CSSProperties } from "react";
import { CircuitElementIcon } from "./CircuitElementIcon";
import type { CircuitElementType } from "./circuit-elements";
import {
  VOLTAGE_REFERENCE_COLOR_A,
  VOLTAGE_REFERENCE_COLOR_B,
} from "./nodes/CircuitElementNode";
import {
  GROUND_HANDLE_POSITION,
  switchBTerminalOffsetPercent,
  TWO_TERMINAL_HANDLE_POSITIONS,
} from "./rotation";

/** ツールボックスのプレビューでのスイッチBの見本端子数(CircuitElementIconの既定値と合わせる) */
const PREVIEW_SWITCH_B_TERMINAL_COUNT = 3;
/** 端子の見た目のサイズ。CircuitElementNode.tsxのHANDLE_VISUAL_SIZEと合わせる(こちらは見た目だけ、実際のHandleではない) */
const TERMINAL_DOT_SIZE = 6;

/** Position(辺)+辺上の位置(0〜100%)から、端子ドットのCSS配置を求める(react-flowの.react-flow__handle-*と同じ規約) */
function terminalDotStyle(
  position: Position,
  percentAlongSide = 50,
): CSSProperties {
  const base: CSSProperties = {
    position: "absolute",
    width: TERMINAL_DOT_SIZE,
    height: TERMINAL_DOT_SIZE,
    borderRadius: "100%",
    border: "1px solid white",
  };
  switch (position) {
    case Position.Left:
      return {
        ...base,
        left: 0,
        top: `${percentAlongSide}%`,
        transform: "translate(-50%, -50%)",
      };
    case Position.Right:
      return {
        ...base,
        right: 0,
        top: `${percentAlongSide}%`,
        transform: "translate(50%, -50%)",
      };
    case Position.Top:
      return {
        ...base,
        top: 0,
        left: `${percentAlongSide}%`,
        transform: "translate(-50%, -50%)",
      };
    default:
      return {
        ...base,
        bottom: 0,
        left: `${percentAlongSide}%`,
        transform: "translate(-50%, 50%)",
      };
  }
}

/**
 * 回路メーカーエリアに配置したときと同じ見た目(枠線+回転アイコン+端子)のプレビュー。
 * ツールボックスの一覧表示・ドラッグ中のフローティングプレビュー(Toolbox.tsx)の
 * 両方からこの同じコンポーネントを使うことで、「ドラッグしても見た目が変わらない」
 * 体験にする。端子は実際の`<Handle>`(React Flowのノード文脈が必要でここでは使えない)
 * ではなく、同じ位置に置いた見た目だけの色付き円で代用する(回転は常に0度扱い)。
 */
export function ToolboxItemPreview({
  elementType,
}: {
  elementType: CircuitElementType;
}) {
  const isGround = elementType === "ground";
  const isJunction = elementType === "junction";
  const isSwitchB = elementType === "switch-b";
  const terminalCount = isSwitchB ? PREVIEW_SWITCH_B_TERMINAL_COUNT : 0;

  return (
    <div
      className={`relative flex items-center justify-center rounded-md border border-slate-400 bg-white text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
        isJunction ? "h-6 w-6" : "h-8 w-8"
      }`}
    >
      <CircuitElementIcon elementId={elementType} />

      {isJunction ? null : isGround ? (
        <span style={terminalDotStyle(GROUND_HANDLE_POSITION[0])} />
      ) : isSwitchB ? (
        <>
          <span
            style={{
              ...terminalDotStyle(TWO_TERMINAL_HANDLE_POSITIONS[0].a),
              background: VOLTAGE_REFERENCE_COLOR_A,
            }}
          />
          {Array.from({ length: terminalCount }, (_, i) => {
            const throwSide = TWO_TERMINAL_HANDLE_POSITIONS[0].b;
            const offset = switchBTerminalOffsetPercent(i, terminalCount);
            return (
              <span
                key={`t${i + 1}`}
                style={{
                  ...terminalDotStyle(throwSide, offset),
                  background: VOLTAGE_REFERENCE_COLOR_B,
                }}
              />
            );
          })}
        </>
      ) : (
        <>
          <span
            style={{
              ...terminalDotStyle(TWO_TERMINAL_HANDLE_POSITIONS[0].a),
              background: VOLTAGE_REFERENCE_COLOR_A,
            }}
          />
          <span
            style={{
              ...terminalDotStyle(TWO_TERMINAL_HANDLE_POSITIONS[0].b),
              background: VOLTAGE_REFERENCE_COLOR_B,
            }}
          />
        </>
      )}
    </div>
  );
}
