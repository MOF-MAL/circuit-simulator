"use client";

import type { CSSProperties } from "react";
import type { CircuitElementType } from "./circuit-elements";

/** viewBoxの1ユニットあたりの描画px数。全素子で統一し、素子ごとのviewBoxユニット→pxの比率を揃える */
const PX_PER_UNIT = 1;

/**
 * 通常素子の箱(32px、1pxボーダー)の内側の一辺の長さ。リード線の先端をここまで届かせ、箱のふち(端子)と隙間なくつながるようにする。
 * 3Dビュー側(simulator-3d/CircuitFloor.tsx)がアイコンをテクスチャ化する際、このユニット数を
 * テクスチャの外枠サイズとして使うため、単一の情報源としてexportする。
 */
export const NORMAL_BOX_CONTENT_UNITS = 30;

/** 素子ごとに異なる大きさのviewBoxから、SVGの共通propsを作る */
function iconSvgProps(vb: { x: number; y: number; w: number; h: number }) {
  return {
    viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}`,
    style: {
      width: vb.w * PX_PER_UNIT,
      height: vb.h * PX_PER_UNIT,
    } satisfies CSSProperties,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    role: "img" as const,
    "aria-hidden": true as const,
  };
}

/**
 * 回路素子の記号（SVG）を描画する共通コンポーネント。
 *
 * ツールボックスのボタンアイコンと、キャンバス上のノード（CircuitElementNode）の
 * どちらからも、この同じコンポーネントを使う。
 * こうしておくことで「記号の見た目を直す」ときに直すべき場所がここ1箇所で済む。
 *
 * 各素子(節点を除く)は一辺30ユニットの正方形のviewBoxを使い、リード線の先端が
 * ちょうどviewBoxの端(=箱のふち、端子Handleの位置)に届くように描く。
 * こうしておくことで、記号のリード線と実際のワイヤーが隙間なくつながって見える
 * （箱を正方形にしているのは、素子を回転してもどの向きでも同じように端まで届くようにするため）。
 */
export function CircuitElementIcon({
  elementId,
  state,
}: {
  elementId: CircuitElementType;
  /**
   * スイッチ系素子の現在の状態。ツールボックスの静止アイコン表示では省略され、
   * その場合は見本として既定の状態（スイッチA=開、スイッチB=端子数3・未接続）を描画する。
   */
  state?: {
    closed?: boolean;
    terminalCount?: number;
    connectedTerminal?: number;
  };
}) {
  const NORMAL_VB = { x: 0, y: 0, w: NORMAL_BOX_CONTENT_UNITS, h: NORMAL_BOX_CONTENT_UNITS };

  switch (elementId) {
    case "resistor":
      // 長方形＝抵抗の回路記号。中心線y=15を軸に上下対称、左右のリード線が箱の端まで届く。
      return (
        <svg {...iconSvgProps(NORMAL_VB)}>
          <title>抵抗の回路記号</title>
          <path d="M0 15h4M26 15h4M4 10h22v10H4z" />
        </svg>
      );

    case "capacitor":
      // 平行な2本の縦線＝コンデンサの回路記号
      return (
        <svg {...iconSvgProps(NORMAL_VB)}>
          <title>コンデンサの回路記号</title>
          <path d="M0 15h12M18 15h12M12 5v20M18 5v20" />
        </svg>
      );

    case "inductor":
      // 連続した3つの半円（山）＝コイルの回路記号。
      // 半円になるように rx と ry を同じ値（3）にしている。
      return (
        <svg {...iconSvgProps(NORMAL_VB)}>
          <title>コイルの回路記号</title>
          <path d="M0 15h6M24 15h6M6 15a3 3 0 0 1 6 0a3 3 0 0 1 6 0a3 3 0 0 1 6 0" />
        </svg>
      );

    case "dc-source":
      // 「長くて細い線（＋極）」と「短い線（－極）」の1組のペア＝直流電源（電池）の回路記号。
      // 太さは＋極・－極とも同じにしている。
      return (
        <svg {...iconSvgProps(NORMAL_VB)}>
          <title>直流電源の回路記号</title>
          {/* 左のリード線 */}
          <path d="M0 15h12" />
          {/* ＋極: 長い線（中心線 y=15 を軸に上下対称） */}
          <path d="M12 3v24" />
          {/* －極: ＋極より短い線。太さは＋極と同じ */}
          <path d="M18 9v12" />
          {/* 右のリード線 */}
          <path d="M18 15h12" />
        </svg>
      );

    case "ac-source":
      // 円の中に正弦波（〜）＝交流電源の回路記号。波は円の中心を軸に左右対称。
      return (
        <svg {...iconSvgProps(NORMAL_VB)}>
          <title>交流電源の回路記号</title>
          <circle cx="15" cy="15" r="10" />
          <path d="M7 15c2 -5 6 -5 8 0s6 5 8 0" />
          <path d="M0 15h5M25 15h5" />
        </svg>
      );

    case "switch-a": {
      // 2つの接点＝スイッチAの回路記号。
      // 開(false): 斜め線が右の接点まで届かない(回路が切れている)
      // 閉(true): まっすぐな線で2つの接点を結ぶ(回路がつながっている)
      const closed = state?.closed ?? false;
      return (
        <svg {...iconSvgProps(NORMAL_VB)}>
          <title>{`スイッチA（${closed ? "閉" : "開"}）の回路記号`}</title>
          <circle cx="8" cy="15" r="2.2" fill="currentColor" />
          <circle cx="22" cy="15" r="2.2" fill="currentColor" />
          <path
            d={
              closed
                ? "M0 15h8M22 15h8M10.2 15h9.6"
                : "M0 15h8M22 15h8M10.2 14 18 8"
            }
          />
        </svg>
      );
    }

    case "switch-b": {
      // 共通端子(左)＋N個の端子(右)＋アーム(接続中の端子を指す線)＝スイッチBの回路記号。
      const terminalCount = Math.max(1, state?.terminalCount ?? 3);
      const connectedTerminal = state?.connectedTerminal ?? 0;
      const pivotX = 8;
      const pivotY = 15;
      // N個の端子を、y=5〜25の範囲に均等に並べる(1個だけのときは中央のy=15)
      const terminalYs = Array.from({ length: terminalCount }, (_, i) =>
        terminalCount === 1 ? 15 : 5 + (i * 20) / (terminalCount - 1),
      );
      return (
        <svg {...iconSvgProps(NORMAL_VB)}>
          <title>スイッチBの回路記号</title>
          {/* 共通端子側のリード線とピボット点 */}
          <path d={`M0 ${pivotY}h${pivotX}`} />
          <circle cx={pivotX} cy={pivotY} r="2.2" fill="currentColor" />
          {/* 各端子のリード線と接点 */}
          {terminalYs.map((y, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 端子数から機械的に生成した固定リストのため
            <g key={i}>
              <path d={`M24 ${y}h6`} />
              <circle cx="24" cy={y} r="2.2" fill="currentColor" />
            </g>
          ))}
          {/* アーム: 接続先が選ばれていれば、ピボットからその端子まで線を引く */}
          {connectedTerminal > 0 && connectedTerminal <= terminalCount && (
            <path
              d={`M${pivotX} ${pivotY}L24 ${terminalYs[connectedTerminal - 1]}`}
            />
          )}
        </svg>
      );
    }

    case "ammeter":
      // 円の中に"A"の文字＝電流計の回路記号(交流電源の円と同じ形を流用)
      return (
        <svg {...iconSvgProps(NORMAL_VB)}>
          <title>電流計の回路記号</title>
          <circle cx="15" cy="15" r="10" />
          <text
            x="15"
            y="15"
            textAnchor="middle"
            dominantBaseline="central"
            stroke="none"
            fill="currentColor"
            fontSize="11"
          >
            A
          </text>
          <path d="M0 15h5M25 15h5" />
        </svg>
      );

    case "voltmeter":
      // 円の中に"V"の文字＝電圧計の回路記号
      return (
        <svg {...iconSvgProps(NORMAL_VB)}>
          <title>電圧計の回路記号</title>
          <circle cx="15" cy="15" r="10" />
          <text
            x="15"
            y="15"
            textAnchor="middle"
            dominantBaseline="central"
            stroke="none"
            fill="currentColor"
            fontSize="11"
          >
            V
          </text>
          <path d="M0 15h5M25 15h5" />
        </svg>
      );

    case "ground":
      // 下にいくほど短くなる横線＝接地(グラウンド)の回路記号。上のリード線は箱の上端まで届く。
      return (
        <svg {...iconSvgProps(NORMAL_VB)}>
          <title>アースの回路記号</title>
          <path d="M15 0v8M3 8h24M7 15h16M11 22h8" />
        </svg>
      );

    case "junction":
      // 節点(合流・分流点)の回路記号。端子そのものが箱の中央にあるため、
      // リード線は持たず、中心の塗りつぶし点のみで表す。
      return (
        <svg {...iconSvgProps({ x: 0, y: 0, w: 22, h: 22 })}>
          <title>節点の回路記号</title>
          <circle cx="11" cy="11" r="5" fill="currentColor" />
        </svg>
      );
  }
}
