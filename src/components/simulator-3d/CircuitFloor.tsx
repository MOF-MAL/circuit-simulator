"use client";

import { useTexture } from "@react-three/drei";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CircuitElementIcon,
  NORMAL_BOX_CONTENT_UNITS,
} from "@/components/circuit-maker/CircuitElementIcon";
import type { CircuitElementNodeType } from "@/components/circuit-maker/nodes/CircuitElementNode";
import { BoxSegment } from "./Segment";
import type {
  CircuitLayout,
  ElementLayout,
  WireLayout,
} from "./use3DCircuitLayout";

/** 配線の色・太さ。2D側の`defaultEdgeOptions`のstroke色と合わせている。 */
const LINE_COLOR = "#111827";
const LINE_THICKNESS = 0.02;

/** 素子アイコンの一辺(ワールド単位)。40px(NODE_SIZE_PX)四方 = 配線と同じスケールの1ユニット。 */
const ICON_SIZE = 1;
/** 配線(y=0〜0.01)と深度が被って明滅(z-fighting)しないよう、少し高く浮かせる */
const ICON_HEIGHT = 0.03;
/** 2D側の`text-slate-900`相当の記号色 */
const ICON_COLOR = "#0f172a";

type IconState = {
  closed?: boolean;
  terminalCount?: number;
  connectedTerminal?: number;
};

/**
 * `CircuitElementIcon`(2D側と共通の唯一の記号定義)をSVG文字列としてレンダリングし、
 * テクスチャとして貼れるdata URIに変換する。通常素子のアイコンは既に一辺
 * `NORMAL_BOX_CONTENT_UNITS`の正方形のviewBoxで、リード線の先端が箱の端(0または
 * `NORMAL_BOX_CONTENT_UNITS`)にちょうど届くように描かれているため、外枠もそれと
 * 同じ寸法にすれば(2D側と縮尺・原点が一致するため、ずらしは不要)、アイコン自身の
 * リード線がそのまま配線の端子位置まで途切れなく届く。`currentColor`を使っている
 * 記号側のstroke/fillが正しく解決されるよう、外枠に`color`スタイルを明示する。
 */
function iconDataUri(
  node: CircuitElementNodeType,
  state: IconState | undefined,
): string {
  const { elementType } = node.data;
  const markup = renderToStaticMarkup(
    <CircuitElementIcon elementId={elementType} state={state} />,
  );
  const inner = markup.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const size = NORMAL_BOX_CONTENT_UNITS;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" ` +
    `fill="none" stroke="currentColor" stroke-width="1.8" style="color:${ICON_COLOR}">` +
    `${inner}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * 素子本体: 3Dの箱ではなく、2D側と共通の`CircuitElementIcon`をテクスチャ化し、
 * 配線と全く同じ座標変換(flowToWorldXZ)・Three.jsのposition/rotationだけで
 * 水平な平面メッシュとして配置する(「回路メーカーエリアの見た目をそのまま貼り付ける」ため)。
 * DOM/CSSを経由しないため、配線とのズレが原理的に起こらない。
 *
 * rotation=[-π/2, 0, θ](Three.jsの既定のXYZオイラー順)は、まずローカルZ軸周りにθ
 * (素子自身の向き)だけ画像を回し、そのあとX軸-90度で床に寝かせる、という順で効く。
 * この向きだと寝かせた後の平面の法線がワールド+Y(カメラ側)を向くため、CSSの
 * `scaleX(-1)`のような鏡像補正なしで正しい向きになる。
 */
function FlatIcon({ element }: { element: ElementLayout }) {
  const { elementType, rotation, params } = element.node.data;
  const closed =
    elementType === "switch-a" ? (params.closed as boolean) : undefined;
  const terminalCount =
    elementType === "switch-b"
      ? Math.max(1, Number(params.terminalCount) || 1)
      : undefined;
  const connectedTerminal =
    elementType === "switch-b"
      ? (params.connectedTerminal as number)
      : undefined;

  const state: IconState | undefined = useMemo(() => {
    if (elementType === "switch-a") return { closed };
    if (elementType === "switch-b") return { terminalCount, connectedTerminal };
    return undefined;
  }, [elementType, closed, terminalCount, connectedTerminal]);

  const dataUri = useMemo(
    () => iconDataUri(element.node, state),
    [element.node, state],
  );
  const texture = useTexture(dataUri);

  return (
    <mesh
      position={[element.center.x, ICON_HEIGHT, element.center.z]}
      rotation={[-Math.PI / 2, 0, (rotation * Math.PI) / 180]}
    >
      <planeGeometry args={[ICON_SIZE, ICON_SIZE]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.1} />
    </mesh>
  );
}

function FlatWire({ wire }: { wire: WireLayout }) {
  return (
    <BoxSegment
      from={[wire.from.x, 0, wire.from.z]}
      to={[wire.to.x, 0, wire.to.z]}
      width={LINE_THICKNESS}
      height={LINE_THICKNESS}
      color={LINE_COLOR}
    />
  );
}

/**
 * 全モード共通の、水平な回路図。回路メーカーの2Dレイアウトと同じ配置(XZ平面)で、
 * 厚みのない配線(細い線)・素子(2D側と共通のアイコン)を描画する
 * (「回路メーカーエリアの見た目をそのまま画像として水平面に貼り付ける」ため)。
 * モードごとの表現(電位の壁、電流・電力のオーバーレイなど)は、この上に`children`として重ねる。
 */
export function CircuitFloor({
  layout,
  children,
}: {
  layout: CircuitLayout;
  children?: ReactNode;
}) {
  return (
    <group>
      {layout.wires.map((wire) => (
        <FlatWire key={wire.edgeId} wire={wire} />
      ))}
      {/* 節点は合流・分流のためだけの素子で、床に記号を描く意味がないため描画対象から除外する
          (配線自体は各端子の絶対位置をそのまま使うため、この除外の影響を受けない) */}
      {layout.elements
        .filter((element) => element.node.data.elementType !== "junction")
        .map((element) => (
          <FlatIcon key={element.id} element={element} />
        ))}
      {children}
    </group>
  );
}
