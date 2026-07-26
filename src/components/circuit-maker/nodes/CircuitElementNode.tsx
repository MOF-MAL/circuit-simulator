"use client";

import {
  Handle,
  type Node,
  type NodeProps,
  useReactFlow,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { useEffect } from "react";
import { CircuitElementIcon } from "../CircuitElementIcon";
import type { CircuitElementType } from "../circuit-elements";
import {
  GROUND_HANDLE_POSITION,
  isVerticalSide,
  type Rotation,
  switchBTerminalOffsetPercent,
  TWO_TERMINAL_HANDLE_POSITIONS,
} from "../rotation";

/** このノードが持つデータ（どの種類の素子か、どちらを向いているか） */
export type CircuitElementNodeData = {
  elementType: CircuitElementType;
  /** ユーザが回路セッティングエリアで自由に変更できる表示名(IDとは別物)。配置直後は種別名。 */
  name: string;
  /** 素子の向き。回路セッティングエリアの回転ボタンでのみ変更する（新規配置時は0度）。 */
  rotation: Rotation;
  /** 抵抗値・電圧など、素子ごとのパラメータ。回路セッティングエリアで編集する。 */
  params: Record<string, number | boolean>;
};

/**
 * 電圧の向きの基準(elementVoltages = Va - Vbの計算と対応)を色で示す。
 * a(スイッチBは共通端子)を赤、b(スイッチBは各端子)を青にする。
 */
const VOLTAGE_REFERENCE_COLOR_A = "#ef4444";
const VOLTAGE_REFERENCE_COLOR_B = "#3b82f6";

/** React Flow の Node 型に、上のデータ型とノードタイプ名("circuitElement")を組み合わせたもの */
export type CircuitElementNodeType = Node<
  CircuitElementNodeData,
  "circuitElement"
>;

/**
 * キャンバス上に配置される、回路素子1つ分のノード（React Flow のカスタムノード）。
 *
 * 7種類の素子（抵抗・コンデンサ・コイル・直流電源・交流電源・スイッチ・接地）を
 * それぞれ別コンポーネントにはせず、data.elementType で見た目を切り替える
 * 1つの汎用コンポーネントにしている（種類ごとの違いは記号(SVG)と端子の数だけのため）。
 *
 * 回転（data.rotation）について:
 * - アイコン(SVG)だけを CSS の transform で視覚的に回転させる。
 * - Handle（端子）自体は回転させず、回転角に応じて Position（Left/Right/Top/Bottom）を
 *   切り替えることで、見た目上の正しい辺に端子が来るようにしている。
 *   （Handle ごと CSS で回転させると、見た目の位置は合っても React Flow 内部の
 *     「配線が膨らむ向き」の計算には元の Position がそのまま使われてしまい、
 *     ワイヤーの見え方が回転後の向きとズレてしまうため。）
 */
export function CircuitElementNode({
  id,
  data,
}: NodeProps<CircuitElementNodeType>) {
  const isGround = data.elementType === "ground";
  const isSwitchA = data.elementType === "switch-a";
  const isSwitchB = data.elementType === "switch-b";
  // スイッチBの端子数(1未満にはしない)
  const terminalCount = isSwitchB
    ? Math.max(1, Number(data.params.terminalCount) || 1)
    : 0;

  const { updateNodeData } = useReactFlow<CircuitElementNodeType>();

  // React Flow は Handle の「サイズ」変化は自動検知するが、
  // カスタムノード内で position を書き換えただけの「位置だけ」の変化までは
  // 自動検知してくれない。そのままだと、既に配線済みのワイヤーが
  // 回転後も古い端子位置につながったままになってしまう。
  // そのため、回転角・スイッチBの端子数が変わるたびに「端子位置キャッシュ」を更新してもらう。
  const updateNodeInternals = useUpdateNodeInternals();
  // biome-ignore lint/correctness/useExhaustiveDependencies: data.rotation/terminalCountはeffect内で参照しないが、変化のたびに再実行させたい意図的な依存
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, data.rotation, terminalCount, updateNodeInternals]);

  return (
    <div className="relative flex h-10 w-10 items-center justify-center rounded-md border border-slate-400 bg-white text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
      {/* アイコン部分だけを回転させる（Handleは回転させない）。スイッチAはクリックでON/OFFを切り替える */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: キャンバス上の素子アイコンのクリック操作で、キーボード操作の対応は今回のスコープ外 */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: 同上 */}
      <div
        style={{
          transform: `rotate(${data.rotation}deg)`,
          cursor: isSwitchA || isSwitchB ? "pointer" : undefined,
        }}
        onClick={
          isSwitchA
            ? () =>
                updateNodeData(id, {
                  params: { ...data.params, closed: !data.params.closed },
                })
            : isSwitchB
              ? () => {
                  // 未接続(0)→端子1→…→端子N→未接続 の順に1つずつ進める
                  const current = Number(data.params.connectedTerminal) || 0;
                  const next = (current + 1) % (terminalCount + 1);
                  updateNodeData(id, {
                    params: { ...data.params, connectedTerminal: next },
                  });
                }
              : undefined
        }
      >
        <CircuitElementIcon
          elementId={data.elementType}
          state={
            isSwitchA
              ? { closed: data.params.closed as boolean }
              : isSwitchB
                ? {
                    terminalCount,
                    connectedTerminal: data.params.connectedTerminal as number,
                  }
                : undefined
          }
        />
      </div>

      {isGround ? (
        // 接地は1端子のみ：回転角に応じた辺にHandleを1つ配置
        <Handle
          type="source"
          position={GROUND_HANDLE_POSITION[data.rotation]}
          id="a"
        />
      ) : isSwitchB ? (
        <>
          {/* 共通端子: 回転角に応じたa側の辺に1つ。電圧の向きの基準として赤にする */}
          <Handle
            type="source"
            position={TWO_TERMINAL_HANDLE_POSITIONS[data.rotation].a}
            id="common"
            style={{ background: VOLTAGE_REFERENCE_COLOR_A }}
          />
          {/* 各端子: 回転角に応じたb側の辺に、端子数ぶん均等に並べる。共通端子との対比で青にする */}
          {Array.from({ length: terminalCount }, (_, i) => {
            const throwSide = TWO_TERMINAL_HANDLE_POSITIONS[data.rotation].b;
            const offset = switchBTerminalOffsetPercent(i, terminalCount);
            return (
              <Handle
                key={`t${i + 1}`}
                type="source"
                position={throwSide}
                id={`t${i + 1}`}
                style={{
                  background: VOLTAGE_REFERENCE_COLOR_B,
                  ...(isVerticalSide(throwSide)
                    ? { top: `${offset}%` }
                    : { left: `${offset}%` }),
                }}
              />
            );
          })}
        </>
      ) : (
        <>
          {/*
            それ以外の素子は2端子：回転角に応じた辺にHandleを配置。
            全素子共通で、a=赤・b=青にして電圧の向きの基準(elementVoltages=Va-Vb)を示す。
          */}
          <Handle
            type="source"
            position={TWO_TERMINAL_HANDLE_POSITIONS[data.rotation].a}
            id="a"
            style={{ background: VOLTAGE_REFERENCE_COLOR_A }}
          />
          <Handle
            type="source"
            position={TWO_TERMINAL_HANDLE_POSITIONS[data.rotation].b}
            id="b"
            style={{ background: VOLTAGE_REFERENCE_COLOR_B }}
          />
        </>
      )}
    </div>
  );
}
