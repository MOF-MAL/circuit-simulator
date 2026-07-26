"use client";

/**
 * インスペクターに表示する1行分（項目名 + 値の入力欄）のモック。
 * Unity などの「プロパティインスペクタ」を参考にした見た目。
 */
function InspectorRow({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-2 px-2 py-1">
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div className="flex items-center gap-1">
        <input
          type="text"
          defaultValue={value}
          // このモックアップの段階では未実装。
          // 後で「選択中の回路素子のパラメータ」を編集・反映できるようにする。
          disabled
          className="w-full rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-700 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
        {unit && (
          <span className="w-6 shrink-0 text-xs text-slate-400">{unit}</span>
        )}
      </div>
    </div>
  );
}

/**
 * 「回路セッティングエリア」全体。
 * 回路メーカーエリアで素子を選択（クリックや右クリック）したときに、
 * その素子のパラメータをここで編集できるようにする想定。
 * 今はまだ選択の仕組みがないので、抵抗素子を選んだ場合の見た目だけを固定表示している。
 */
export function SettingsArea() {
  return (
    <div className="flex h-full w-full flex-col overflow-auto">
      <p className="shrink-0 border-b border-slate-300 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        回路セッティングエリア
      </p>

      <div className="flex-1 divide-y divide-slate-200 dark:divide-slate-800">
        <div className="px-2 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
          選択中の素子: 抵抗 R1（表示例）
        </div>
        <InspectorRow label="名称" value="R1" />
        <InspectorRow label="抵抗値" value="100" unit="Ω" />
        <InspectorRow label="定格電力" value="0.25" unit="W" />
      </div>
    </div>
  );
}
