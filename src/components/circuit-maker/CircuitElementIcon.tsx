"use client";

import type { CircuitElementType } from "./circuit-elements";

/**
 * 回路素子の記号（SVG）を描画する共通コンポーネント。
 *
 * ツールボックスのボタンアイコンと、キャンバス上のノード（CircuitElementNode）の
 * どちらからも、この同じコンポーネントを使う。
 * こうしておくことで「記号の見た目を直す」ときに直すべき場所がここ1箇所で済む。
 *
 * すべての記号は viewBox="0 0 40 24" で、リード線（導線）の中心を y=12 とし、
 * 記号の形はこの中心線に対して上下対称になるように描いている
 * （日本の高校物理の教科書・JISに準拠した回路図記号を意識している）。
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
  const commonProps = {
    viewBox: "0 0 40 24",
    className: "h-5 w-8",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    role: "img" as const,
    "aria-hidden": true as const,
  };

  switch (elementId) {
    case "resistor":
      // 長方形＝抵抗の回路記号。
      // 長方形は y=9〜15（中心線 y=12 を軸に上下対称、高さ6）にし、
      // 左右のリード線がちょうど長方形の垂直方向の中心を貫通するようにしている。
      return (
        <svg {...commonProps}>
          <title>抵抗の回路記号</title>
          <path d="M2 12h8M30 12h8M10 9h20v6H10z" />
        </svg>
      );

    case "capacitor":
      // 平行な2本の縦線＝コンデンサの回路記号
      return (
        <svg {...commonProps}>
          <title>コンデンサの回路記号</title>
          <path d="M2 12h15M23 12h15M17 4v16M23 4v16" />
        </svg>
      );

    case "inductor":
      // 連続した3つの半円（山）＝コイルの回路記号。
      // 半円になるように rx と ry を同じ値（4）にしている
      // （rx と ry が異なると、山が縦や横に潰れた楕円になってしまう）。
      // 山の範囲は x=8〜32 なので、左右のリード線をその外側（2〜8, 32〜38）にして、
      // 山の途中にリード線が突き刺さらないようにしている。
      return (
        <svg {...commonProps}>
          <title>コイルの回路記号</title>
          <path d="M2 12h6M32 12h6M8 12a4 4 0 0 1 8 0a4 4 0 0 1 8 0a4 4 0 0 1 8 0" />
        </svg>
      );

    case "dc-source":
      // 「長くて細い線（＋極）」と「短くて太い線（－極）」の1組のペア＝直流電源（電池）の回路記号。
      return (
        <svg {...commonProps}>
          <title>直流電源の回路記号</title>
          {/* 左のリード線 */}
          <path d="M2 12h15" />
          {/* ＋極: 長くて細い線（中心線 y=12 を軸に上下対称、y=4〜20） */}
          <path d="M17 4v16" />
          {/* －極: ＋極より短い線（y=8〜16）。太さも強調するため、
              この線だけ commonProps の strokeWidth を上書きしている */}
          <path d="M23 8v8" strokeWidth={4} strokeLinecap="butt" />
          {/* 右のリード線 */}
          <path d="M23 12h15" />
        </svg>
      );

    case "ac-source":
      // 円の中に正弦波（〜）＝交流電源の回路記号。
      // 波の開始・終了点（x=13, 27）が、円の中心（x=20）を軸にちょうど左右対称になるようにしている。
      return (
        <svg {...commonProps}>
          <title>交流電源の回路記号</title>
          <circle cx="20" cy="12" r="8" />
          <path d="M13 12c1.75 -4 5.25 -4 7 0s5.25 4 7 0" />
          <path d="M2 12h10M28 12h10" />
        </svg>
      );

    case "switch-a": {
      // 2つの接点＝スイッチAの回路記号。
      // 開(false): 斜め線が右の接点まで届かない(回路が切れている)
      // 閉(true): まっすぐな線で2つの接点を結ぶ(回路がつながっている)
      const closed = state?.closed ?? false;
      return (
        <svg {...commonProps}>
          <title>{`スイッチA（${closed ? "閉" : "開"}）の回路記号`}</title>
          <circle cx="8" cy="12" r="1.6" fill="currentColor" />
          <circle cx="32" cy="12" r="1.6" fill="currentColor" />
          <path
            d={
              closed
                ? "M2 12h4M34 12h4M9.5 12h21"
                : "M2 12h4M34 12h4M9.5 11.2 26 5"
            }
          />
        </svg>
      );
    }

    case "switch-b": {
      // 共通端子(左)＋N個の端子(右)＋アーム(接続中の端子を指す線)＝スイッチBの回路記号。
      const terminalCount = Math.max(1, state?.terminalCount ?? 3);
      const connectedTerminal = state?.connectedTerminal ?? 0;
      const pivotX = 10;
      const pivotY = 12;
      // N個の端子を、y=4〜20の範囲に均等に並べる(1個だけのときは中央のy=12)
      const terminalYs = Array.from({ length: terminalCount }, (_, i) =>
        terminalCount === 1 ? 12 : 4 + (i * 16) / (terminalCount - 1),
      );
      return (
        <svg {...commonProps}>
          <title>スイッチBの回路記号</title>
          {/* 共通端子側のリード線とピボット点 */}
          <path d={`M2 ${pivotY}h${pivotX - 2}`} />
          <circle cx={pivotX} cy={pivotY} r="1.6" fill="currentColor" />
          {/* 各端子のリード線と接点 */}
          {terminalYs.map((y, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 端子数から機械的に生成した固定リストのため
            <g key={i}>
              <path d={`M30 ${y}h6`} />
              <circle cx="30" cy={y} r="1.6" fill="currentColor" />
            </g>
          ))}
          {/* アーム: 接続先が選ばれていれば、ピボットからその端子まで線を引く */}
          {connectedTerminal > 0 && connectedTerminal <= terminalCount && (
            <path
              d={`M${pivotX} ${pivotY}L30 ${terminalYs[connectedTerminal - 1]}`}
            />
          )}
        </svg>
      );
    }

    case "ammeter":
      // 円の中に"A"の文字＝電流計の回路記号(交流電源の円と同じ形を流用)
      return (
        <svg {...commonProps}>
          <title>電流計の回路記号</title>
          <circle cx="20" cy="12" r="8" />
          <text
            x="20"
            y="12"
            textAnchor="middle"
            dominantBaseline="central"
            stroke="none"
            fill="currentColor"
            fontSize="9"
          >
            A
          </text>
          <path d="M2 12h10M28 12h10" />
        </svg>
      );

    case "voltmeter":
      // 円の中に"V"の文字＝電圧計の回路記号
      return (
        <svg {...commonProps}>
          <title>電圧計の回路記号</title>
          <circle cx="20" cy="12" r="8" />
          <text
            x="20"
            y="12"
            textAnchor="middle"
            dominantBaseline="central"
            stroke="none"
            fill="currentColor"
            fontSize="9"
          >
            V
          </text>
          <path d="M2 12h10M28 12h10" />
        </svg>
      );

    case "ground":
      // 下にいくほど短くなる横線＝接地(グラウンド)の回路記号
      return (
        <svg {...commonProps}>
          <title>アースの回路記号</title>
          <path d="M20 2v8M12 10h16M15 15h10M18 20h4" />
        </svg>
      );
  }
}
