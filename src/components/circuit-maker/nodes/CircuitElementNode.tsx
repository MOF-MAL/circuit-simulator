"use client";

import {
  Handle,
  type Node,
  type NodeProps,
  Position,
  useReactFlow,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { type CSSProperties, useEffect } from "react";
import { CircuitElementIcon } from "../CircuitElementIcon";
import type { CircuitElementType } from "../circuit-elements";
import {
  GROUND_HANDLE_POSITION,
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
 * ツールボックスのプレビュー(ToolboxItemPreview.tsx)でも同じ色を使うためexportする。
 */
export const VOLTAGE_REFERENCE_COLOR_A = "#ef4444";
export const VOLTAGE_REFERENCE_COLOR_B = "#3b82f6";

/** 端子(Handle)のクリック/ドラッグ当たり判定。既定の6pxだと小さすぎるため広げる */
const HANDLE_HIT_SIZE = 14;
/** 端子の見た目の円のサイズ。当たり判定(HANDLE_HIT_SIZE)より小さい、元の見た目に近いサイズに戻す */
const HANDLE_VISUAL_SIZE = 6;

/**
 * Handleの当たり判定(見えない箱)のstyleを作る。
 *
 * react-flowは実際のワイヤーの接続点として、Handleの「中心」ではなく
 * 「Positionの向いている側の辺」をそのまま使う(@xyflow/systemの`getHandlePosition`参照:
 * 例えばPosition.Leftなら`x = handle.x`＝Handle自身の描画ボックスの左端)。
 * react-flow既定のCSS(`.react-flow__handle-left`等)は、Handleの「中心」が素子の境界線
 * (または節点なら中心点)にちょうど来るように配置する前提になっているため、
 * 当たり判定を広げてHandle自体を大きくすると、その分だけ実際の接続点が境界線からズレてしまう。
 *
 * そのためここでは、Positionの向いている軸(境界線に接する側)は一切ずらさず
 * (`anchorPercent`の位置にHandleの辺をそのまま合わせ、内側にだけ広がるようにする)、
 * それと垂直な軸(辺に沿った方向)だけ従来通り`alongOffsetPercent`を中心に据える。
 * こうすることで、react-flowが実際に使う接続点の座標が、常に境界線(または節点の中心)と一致する。
 */
function hitAreaStyle(
  position: Position,
  options?: { anchorPercent?: number; alongOffsetPercent?: number },
): CSSProperties {
  const anchor = options?.anchorPercent ?? 0;
  const along = options?.alongOffsetPercent ?? 50;
  const base: CSSProperties = {
    width: HANDLE_HIT_SIZE,
    height: HANDLE_HIT_SIZE,
    background: "transparent",
    border: "none",
  };
  switch (position) {
    case Position.Left:
      return { ...base, left: `${anchor}%`, top: `${along}%`, transform: "translateY(-50%)" };
    case Position.Right:
      return { ...base, right: `${anchor}%`, top: `${along}%`, transform: "translateY(-50%)" };
    case Position.Top:
      return { ...base, top: `${anchor}%`, left: `${along}%`, transform: "translateX(-50%)" };
    default:
      return { ...base, bottom: `${anchor}%`, left: `${along}%`, transform: "translateX(-50%)" };
  }
}

/**
 * 見た目の端子ドット(色付きの丸)を、Handleの境界線側の辺にちょうど中心が重なるように配置する。
 * ドットは常にHandle自身(の描画ボックス)を基準(=positioning context)にした子要素であり、
 * 辺に沿った方向の位置(スイッチBの各端子オフセットなど)は既にHandle自身の配置(`hitAreaStyle`の
 * `alongOffsetPercent`)で決まっているため、ここではHandle自身の中でただ中央寄せするだけでよい
 * (`top:50%`等をHandleの高さ・幅に対する割合として使うため、ノード全体に対する割合を
 * 重ねて指定してしまうと基準がズレる点に注意)。
 */
function terminalDotStyle(position: Position): CSSProperties {
  const base: CSSProperties = { width: HANDLE_VISUAL_SIZE, height: HANDLE_VISUAL_SIZE };
  switch (position) {
    case Position.Left:
      return { ...base, left: 0, top: "50%", transform: "translate(-50%, -50%)" };
    case Position.Right:
      return { ...base, right: 0, top: "50%", transform: "translate(50%, -50%)" };
    case Position.Top:
      return { ...base, top: 0, left: "50%", transform: "translate(-50%, -50%)" };
    default:
      return { ...base, bottom: 0, left: "50%", transform: "translate(-50%, 50%)" };
  }
}

/** Handle自体は当たり判定のためにHANDLE_HIT_SIZEの透明な箱にし、見た目の色付き円はこの位置合わせ済みドットで表現する */
function TerminalDot({
  color,
  position,
}: {
  color?: string;
  position: Position;
}) {
  return (
    <span
      className="pointer-events-none absolute rounded-full border border-white dark:border-slate-900"
      style={{
        ...terminalDotStyle(position),
        background: color ?? "var(--xy-handle-background-color-default, #555)",
      }}
    />
  );
}

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
  // 節点は端子1つのみだが、アースと違い箱の中央に固定(回転角に依存しない)ため別扱いにする
  const isJunction = data.elementType === "junction";
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
    <div
      className={`relative flex items-center justify-center rounded-md border border-slate-400 bg-white text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${
        isJunction ? "h-6 w-6" : "h-8 w-8"
      }`}
    >
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

      {isJunction ? (
        // 節点は1端子のみで、常に箱の中央に固定(回転角に依存しない)。
        // アイコン自体(CircuitElementIcon)がすでに「点」の見た目を持つため、
        // Handleは当たり判定のためだけの透明な箱にし、TerminalDotは重ねて描画しない。
        // position自体はReact Flow内部のワイヤー膨らみ計算にのみ使われるが、
        // 接続点の計算に使われる軸(Position.Topならy)がちょうど中心(anchorPercent:50)に来るようにする。
        <Handle
          type="source"
          position={Position.Top}
          id="a"
          style={hitAreaStyle(Position.Top, { anchorPercent: 50 })}
        />
      ) : isGround ? (
        // 接地は1端子のみ：回転角に応じた辺にHandleを1つ配置
        <Handle
          type="source"
          position={GROUND_HANDLE_POSITION[data.rotation]}
          id="a"
          style={hitAreaStyle(GROUND_HANDLE_POSITION[data.rotation])}
        >
          <TerminalDot position={GROUND_HANDLE_POSITION[data.rotation]} />
        </Handle>
      ) : isSwitchB ? (
        <>
          {/* 共通端子: 回転角に応じたa側の辺に1つ。電圧の向きの基準として赤にする */}
          <Handle
            type="source"
            position={TWO_TERMINAL_HANDLE_POSITIONS[data.rotation].a}
            id="common"
            style={hitAreaStyle(TWO_TERMINAL_HANDLE_POSITIONS[data.rotation].a)}
          >
            <TerminalDot
              position={TWO_TERMINAL_HANDLE_POSITIONS[data.rotation].a}
              color={VOLTAGE_REFERENCE_COLOR_A}
            />
          </Handle>
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
                style={hitAreaStyle(throwSide, { alongOffsetPercent: offset })}
              >
                <TerminalDot position={throwSide} color={VOLTAGE_REFERENCE_COLOR_B} />
              </Handle>
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
            style={hitAreaStyle(TWO_TERMINAL_HANDLE_POSITIONS[data.rotation].a)}
          >
            <TerminalDot
              position={TWO_TERMINAL_HANDLE_POSITIONS[data.rotation].a}
              color={VOLTAGE_REFERENCE_COLOR_A}
            />
          </Handle>
          <Handle
            type="source"
            position={TWO_TERMINAL_HANDLE_POSITIONS[data.rotation].b}
            id="b"
            style={hitAreaStyle(TWO_TERMINAL_HANDLE_POSITIONS[data.rotation].b)}
          >
            <TerminalDot
              position={TWO_TERMINAL_HANDLE_POSITIONS[data.rotation].b}
              color={VOLTAGE_REFERENCE_COLOR_B}
            />
          </Handle>
        </>
      )}
    </div>
  );
}
