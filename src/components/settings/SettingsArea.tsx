"use client";

import { useNodes, useReactFlow } from "@xyflow/react";
import { ELEMENT_PARAM_DEFS } from "@/components/circuit-maker/circuit-elements";
import type { CircuitElementNodeType } from "@/components/circuit-maker/nodes/CircuitElementNode";
import { nextRotation } from "@/components/circuit-maker/rotation";

/**
 * 「回路セッティングエリア」全体。
 * 回路メーカーエリア(CircuitCanvas)で選択されている素子の情報を表示し、
 * 回転操作を行えるようにする。
 *
 * ここで使っている useNodes()・useReactFlow() は、AppShell.tsx で
 * 引き上げた ReactFlowProvider の子孫であれば、CircuitCanvas とは別の
 * コンポーネントからでも同じノード配列を読み書きできる、という React Flow の
 * 仕組みを利用している。
 *
 * 抵抗値(Ω)などの数値パラメータの編集は、まだ実装していない
 * （このコンポーネントの表示部分に、次のステップで入力欄を追加していく想定）。
 */
export function SettingsArea() {
  // useNodes(): 現在のノード配列を購読するフック。
  // ノードの選択状態や位置が変わるたびに再レンダリングされるが、
  // このコンポーネントの表示内容は軽いため今回はこれで十分
  // （将来、動作が重く感じるようになったら useStore で
  //  「選択中ノードのidとdataだけ」を購読する形に絞り込む余地がある）。
  const nodes = useNodes<CircuitElementNodeType>();
  const { updateNodeData } = useReactFlow<CircuitElementNodeType>();

  const selectedNode = nodes.find((node) => node.selected);

  return (
    <div className="flex h-full w-full flex-col overflow-auto">
      <p className="shrink-0 border-b border-slate-300 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        回路セッティングエリア
      </p>

      {!selectedNode ? (
        // 何も選択されていないときの案内文
        <div className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">
          素子が選択されていません。回路メーカーエリアで素子をクリック（または右クリック）すると、ここに詳細が表示されます。
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {/* 選択中の素子名(編集可)・ID・回転ボタンを1行にまとめてコンパクトに表示 */}
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
            <input
              type="text"
              value={selectedNode.data.name}
              onChange={(event) =>
                updateNodeData(selectedNode.id, { name: event.target.value })
              }
              className="min-w-0 flex-1 truncate rounded border border-transparent bg-transparent px-1 font-semibold text-slate-700 hover:border-slate-300 focus:border-slate-400 focus:outline-none dark:text-slate-200 dark:hover:border-slate-600"
            />
            <span className="truncate text-[11px] text-slate-400">
              ID: {selectedNode.id}
            </span>
            <button
              type="button"
              onClick={() => {
                // updateNodeData: 指定したノード1件の data だけを更新する関数。
                // ここで更新すると、CircuitCanvas 側のノード配列にも
                // (同じ ReactFlowProvider を共有しているため)自動的に反映される。
                updateNodeData(selectedNode.id, {
                  rotation: nextRotation(selectedNode.data.rotation),
                });
              }}
              className="shrink-0 rounded border border-slate-300 px-2 py-1 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              ↻ 90°回転
            </button>
          </div>

          {/* 素子の種類ごとのパラメータ入力欄 */}
          {ELEMENT_PARAM_DEFS[selectedNode.data.elementType].map((def) => (
            <div
              key={def.key}
              className="flex items-center justify-between gap-2 px-2 py-1.5"
            >
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {def.label}
                {def.kind === "number" && def.unit && ` (${def.unit})`}
              </span>
              {def.kind === "number" && (
                <input
                  type="number"
                  value={selectedNode.data.params[def.key] as number}
                  onChange={(event) => {
                    const newParams = {
                      ...selectedNode.data.params,
                      [def.key]: Number(event.target.value),
                    };
                    // スイッチBの端子数を減らしたとき、接続先がその範囲外になっていたら未接続に戻す
                    if (
                      def.key === "terminalCount" &&
                      Number(newParams.connectedTerminal) >
                        Number(newParams[def.key])
                    ) {
                      newParams.connectedTerminal = 0;
                    }
                    updateNodeData(selectedNode.id, { params: newParams });
                  }}
                  className="w-24 rounded border border-slate-300 px-1.5 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                />
              )}
              {def.kind === "boolean" && (
                <input
                  type="checkbox"
                  checked={selectedNode.data.params[def.key] as boolean}
                  onChange={(event) =>
                    updateNodeData(selectedNode.id, {
                      params: {
                        ...selectedNode.data.params,
                        [def.key]: event.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
              )}
              {def.kind === "terminal-select" && (
                <select
                  value={selectedNode.data.params[def.key] as number}
                  onChange={(event) =>
                    updateNodeData(selectedNode.id, {
                      params: {
                        ...selectedNode.data.params,
                        [def.key]: Number(event.target.value),
                      },
                    })
                  }
                  className="rounded border border-slate-300 px-1.5 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                >
                  <option value={0}>未接続</option>
                  {Array.from(
                    {
                      length:
                        Number(selectedNode.data.params.terminalCount) || 0,
                    },
                    (_, i) => i + 1,
                  ).map((n) => (
                    <option key={n} value={n}>
                      端子{n}に接続
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
