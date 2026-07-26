"use client";

/**
 * ツールボックスに並べる回路素子の一覧（モックアップ用のデータ）。
 * 実際にドラッグ＆ドロップで回路メーカーエリアに配置できるようにするのは
 * 次のステップ（@xyflow/react の導入）で行う。
 */
const TOOLBOX_ITEMS = [
  { id: "resistor", label: "抵抗" },
  { id: "capacitor", label: "コンデンサ" },
  { id: "inductor", label: "コイル" },
  { id: "battery", label: "電池" },
  { id: "ac-source", label: "交流電源" },
  { id: "switch", label: "スイッチ" },
  { id: "ground", label: "接地" },
] as const;

/** ツールボックス内の各素子アイコンの見た目を、素子の種類ごとに切り替えて描画する */
function ElementIcon({
  elementId,
}: {
  elementId: (typeof TOOLBOX_ITEMS)[number]["id"];
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
      // 長方形＝抵抗の回路記号
      return (
        <svg {...commonProps}>
          <title>抵抗の回路記号</title>
          <path d="M2 12h8M30 12h8M10 12h20v-6H10z" />
        </svg>
      );
    case "capacitor":
      // 平行な2本の線＝コンデンサの回路記号
      return (
        <svg {...commonProps}>
          <title>コンデンサの回路記号</title>
          <path d="M2 12h15M23 12h15M17 4v16M23 4v16" />
        </svg>
      );
    case "inductor":
      // 連続した半円＝コイルの回路記号
      return (
        <svg {...commonProps}>
          <title>コイルの回路記号</title>
          <path d="M2 12h4M34 12h4M6 12a4 6 0 0 1 8 0 4 6 0 0 1 8 0 4 6 0 0 1 8 0 4 6 0 0 1 8 0" />
        </svg>
      );
    case "battery":
      // 長い線と短い線＝電池（直流電源）の回路記号
      return (
        <svg {...commonProps}>
          <title>電池の回路記号</title>
          <path d="M2 12h12M26 12h12M14 4v16M17 8v8M23 8v8M26 4v16" />
        </svg>
      );
    case "ac-source":
      // 円の中に波線＝交流電源の回路記号
      return (
        <svg {...commonProps}>
          <title>交流電源の回路記号</title>
          <circle cx="20" cy="12" r="8" />
          <path d="M2 12h10M28 12h10M14 12c1.5-3 3-3 4.5 0s3 3 4.5 0" />
        </svg>
      );
    case "switch":
      // 開いた接点＝スイッチの回路記号
      return (
        <svg {...commonProps}>
          <title>スイッチの回路記号</title>
          <circle cx="8" cy="12" r="1.6" fill="currentColor" />
          <circle cx="32" cy="12" r="1.6" fill="currentColor" />
          <path d="M2 12h4M34 12h4M9.5 11.2 26 5" />
        </svg>
      );
    case "ground":
      // 下にいくほど短くなる横線＝接地(グラウンド)の回路記号
      return (
        <svg {...commonProps}>
          <title>接地の回路記号</title>
          <path d="M20 2v8M12 10h16M15 15h10M18 20h4" />
        </svg>
      );
  }
}

/**
 * 回路メーカーエリアの左側に配置する、回路素子のパレット（ツールボックス）。
 * ここから素子をドラッグして、右側のキャンバスに回路を組み立てる想定。
 */
export function Toolbox() {
  return (
    <div className="flex h-full w-full flex-col gap-1 overflow-y-auto border-r border-slate-300 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-900/40">
      {TOOLBOX_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          // TODO: 次のステップで、この要素を react-flow キャンバスへ
          // ドラッグ＆ドロップできるように draggable 化する
          className="flex flex-col items-center gap-1 rounded-md border border-transparent p-1.5 text-[10px] leading-tight text-slate-600 hover:border-slate-300 hover:bg-white dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          title={item.label}
        >
          <ElementIcon elementId={item.id} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
