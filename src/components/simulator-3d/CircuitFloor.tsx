"use client";

import { useTexture } from "@react-three/drei";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CircuitElementIcon } from "@/components/circuit-maker/CircuitElementIcon";
import type { CircuitElementNodeType } from "@/components/circuit-maker/nodes/CircuitElementNode";
import { getHandleIds } from "@/lib/circuit-solver/topology";
import { terminalAbsolutePosition } from "./geometry";
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
/** 端子の継ぎ足し線(箱の端から中心方向への長さ)。記号自身のリード線と重なって途切れなく見える程度に長くしている */
const STUB_LENGTH = 10;

type IconState = {
  closed?: boolean;
  terminalCount?: number;
  connectedTerminal?: number;
};

/**
 * 各端子(ハンドル)の位置(箱のローカル座標0〜40、素子自身の回転は考慮しない未回転状態)から、
 * 箱の中心方向へ向かう短い直線のパスデータを作る。`CircuitElementIcon`のリード線は
 * 箱の端まで届かず手前で止まっているため(2D側ではHandleの丸印が隙間を隠している)、
 * この継ぎ足し線を重ねることで3Dの配線とアイコンのリード線が途切れず繋がって見えるようにする。
 * (素子自身の回転はメッシュの`rotation.z`で別途かけるため、ここでは常にrotation=0として求める)
 */
function terminalStubPaths(node: CircuitElementNodeType): string {
  const flatNode: CircuitElementNodeType = {
    ...node,
    data: { ...node.data, rotation: 0 },
  };
  return getHandleIds(node)
    .map((handleId) => {
      const pos = terminalAbsolutePosition(flatNode, handleId);
      const localX = pos.x - node.position.x;
      const localY = pos.y - node.position.y;
      const dx = 20 - localX;
      const dy = 20 - localY;
      const len = Math.hypot(dx, dy) || 1;
      const innerX = localX + (dx / len) * STUB_LENGTH;
      const innerY = localY + (dy / len) * STUB_LENGTH;
      return `M${localX} ${localY}L${innerX} ${innerY}`;
    })
    .join("");
}

/**
 * `CircuitElementIcon`(2D側と共通の唯一の記号定義)をSVG文字列としてレンダリングし、
 * テクスチャとして貼れるdata URIに変換する。40×24のviewBoxを、2D側の見た目(40×40の枠に
 * 上下中央揃え)と揃うよう40×40の外枠でラップする。`currentColor`を使っている
 * 記号側のstroke/fillが正しく解決されるよう、外枠に`color`スタイルを明示する。
 * 端子の継ぎ足し線(`terminalStubPaths`)も、内側コンテンツと同じstroke設定を継承する形で追加する。
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
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" ` +
    `fill="none" stroke="currentColor" stroke-width="1.8" style="color:${ICON_COLOR}">` +
    `<path d="${terminalStubPaths(node)}" />` +
    `<g transform="translate(0,8)">${inner}</g></svg>`;
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
