"use client";

import {
  addEdge,
  Background,
  type Connection,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  type Edge,
  type EdgeMouseHandler,
  type NodeMouseHandler,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
// React Flow 本体の見た目（ノードの枠線・線の描画など）に必要なCSS。
// Tailwind CSS のクラスと衝突しないよう、React Flow を実際に使うこのファイルの中だけで読み込む。
import "@xyflow/react/dist/style.css";
import { useCallback, useState } from "react";
import { createDefaultParams, elementTypeLabel } from "./circuit-elements";
import {
  CircuitElementNode,
  type CircuitElementNodeType,
} from "./nodes/CircuitElementNode";

// ノードタイプの対応表。"circuitElement" という名前のノードは
// すべて CircuitElementNode コンポーネントで描画する、という登録。
// コンポーネントの外（モジュールスコープ）で1回だけ定義することで、
// 再レンダリングのたびに新しいオブジェクトが作られてしまうのを防いでいる
// （React Flow は nodeTypes が毎回変わると警告を出し、パフォーマンスも落ちる）。
const nodeTypes = {
  circuitElement: CircuitElementNode,
};

/** 人差し指を伸ばした手のアイコン(編集モード用)。素子・ワイヤーをつまんで操作するイメージ */
function PointerHandIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
    >
      {/* 伸ばした人差し指(拳の中央ではなく左寄りに配置し、中指を立てたように見えないようにする) */}
      <rect x="7" y="2" width="3.5" height="11" rx="1.6" />
      {/* 握った拳(指の付け根に重ねて、切れ目なく1つの手に見えるようにする) */}
      <rect x="5" y="10" width="14" height="10" rx="3" />
      {/* 親指(拳の右側にはっきり見える位置・大きさで描き、指1本だけの見た目にならないようにする) */}
      <rect
        x="15"
        y="11"
        width="6.5"
        height="4.2"
        rx="1.8"
        transform="rotate(24 15 13)"
      />
    </svg>
  );
}

/** 消しゴムのアイコン(消しゴムモード用) */
function EraserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect
        x="4.5"
        y="10.5"
        width="15"
        height="8"
        rx="1.5"
        transform="rotate(-30 12 14.5)"
      />
      <path d="M9 10.5 13 18.5" transform="rotate(-30 12 14.5)" />
    </svg>
  );
}

/** 回路メーカーエリアの操作モード。切り替えボタンの並び順・アイコン・ラベルもここで定義する */
type CircuitMakerMode = "edit" | "eraser";
const MODE_OPTIONS: {
  id: CircuitMakerMode;
  label: string;
  Icon: () => React.JSX.Element;
}[] = [
  { id: "edit", label: "編集モード", Icon: PointerHandIcon },
  { id: "eraser", label: "消しゴムモード", Icon: EraserIcon },
];

/** キャンバス上に浮かべるボタン共通のカード状コンテナ。目立たせるため白背景+枠線+影を付ける */
const FLOATING_PANEL_CLASS =
  "flex gap-1 rounded-md border border-slate-300 bg-white p-1 shadow-md dark:border-slate-600 dark:bg-slate-800";
const FLOATING_BUTTON_ACTIVE_CLASS =
  "flex items-center justify-center rounded px-2 py-1.5 text-[11px] font-medium text-white bg-blue-500";
const FLOATING_BUTTON_CLASS =
  "flex items-center justify-center rounded px-2 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700";

/** 起動時から回路メーカーエリアに置いておく、電位の基準となるアース */
const INITIAL_NODES: CircuitElementNodeType[] = [
  {
    id: "ground-default",
    type: "circuitElement",
    position: { x: 40, y: 40 },
    data: {
      elementType: "ground",
      name: elementTypeLabel("ground"),
      rotation: 0,
      params: createDefaultParams("ground"),
    },
  },
];

/**
 * 「回路メーカーエリア」のキャンバス部分。
 * @xyflow/react（React Flow）を使い、ツールボックスからドラッグ＆ドロップされた
 * 回路素子をノードとして配置し、ノード同士をワイヤー（エッジ）でつなげられるようにしている。
 *
 * ReactFlowProvider は AppShell.tsx 側で（回路セッティングエリアと共有できるように）
 * 上位に引き上げてあるため、このコンポーネント自身はラップしていない。
 *
 * 操作モード(編集/消しゴム)とクリアボタンは、nodes/edgesのローカルstateをこのコンポーネントが
 * 持っているため、ここで完結させて Panel（React Flowのキャンバス上オーバーレイ）として表示する。
 *
 * 実際の回路計算（MNAなど）はまだ行っていない。
 * 今のところは「素子を自由に配置して線でつなぐ・回転させる」という見た目・操作性のみを実現している。
 */
export function CircuitCanvas() {
  const [mode, setMode] = useState<CircuitMakerMode>("edit");
  const [nodes, setNodes, onNodesChange] =
    useNodesState<CircuitElementNodeType>(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  // アース以外のすべての素子・ワイヤーを消去する(確認ダイアログで誤操作を防ぐ)
  const handleClear = useCallback(() => {
    if (!window.confirm("回路をクリアしますか?(アースは残ります)")) return;
    setNodes((currentNodes) =>
      currentNodes.filter((n) => n.data.elementType === "ground"),
    );
    setEdges([]);
  }, [setNodes, setEdges]);

  // ノードのHandle同士をドラッグでつないだときに呼ばれ、線（エッジ）を追加する
  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((currentEdges) => addEdge(connection, currentEdges)),
    [setEdges],
  );

  // ワイヤーをダブルクリックすると、その配線を解除する
  const onEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setEdges((currentEdges) => currentEdges.filter((e) => e.id !== edge.id));
    },
    [setEdges],
  );

  // 消しゴムモード中に素子をクリックすると、その素子と接続ワイヤーを削除する。
  // アースは電位の基準となる特別な素子のため、消しゴムモードでも保護して削除させない。
  const onNodeClick: NodeMouseHandler<CircuitElementNodeType> = useCallback(
    (_event, node) => {
      if (mode !== "eraser") return;
      if (node.data.elementType === "ground") return;
      setNodes((currentNodes) => currentNodes.filter((n) => n.id !== node.id));
      setEdges((currentEdges) =>
        currentEdges.filter(
          (e) => e.source !== node.id && e.target !== node.id,
        ),
      );
    },
    [mode, setNodes, setEdges],
  );

  // 消しゴムモード中にワイヤーをクリックすると、その配線を削除する
  const onEdgeClick: EdgeMouseHandler<Edge> = useCallback(
    (_event, edge) => {
      if (mode !== "eraser") return;
      setEdges((currentEdges) => currentEdges.filter((e) => e.id !== edge.id));
    },
    [mode, setEdges],
  );

  // 素子を右クリックしたときにも、左クリックと同じように選択状態にする
  // （回路セッティングエリアで確認・回転操作ができるようにするため）。
  const onNodeContextMenu: NodeMouseHandler<CircuitElementNodeType> =
    useCallback(
      (event, node) => {
        // ブラウザ標準の右クリックメニューは表示させない
        event.preventDefault();
        setNodes((currentNodes) =>
          currentNodes.map((n) => ({ ...n, selected: n.id === node.id })),
        );
      },
      [setNodes],
    );

  // 素子のドラッグ移動が終わったときに呼ばれる。
  // ドロップ位置がツールボックス（Toolbox.tsxのdata-toolbox-dropzone）の上なら、
  // 「捨てた」とみなしてそのノードと、つながっていたワイヤーを削除する。
  // React Flowのノードドラッグはネイティブのdrag&dropではなくマウス操作で実装されているため、
  // document.elementFromPointで実際にマウスの下にある要素を調べて判定している。
  const onNodeDragStop = useCallback(
    (event: MouseEvent | TouchEvent, node: CircuitElementNodeType) => {
      // マウス操作とタッチ操作で座標の取得場所が異なるため、両方に対応する
      const point = "touches" in event ? event.changedTouches[0] : event;
      const droppedOnToolbox = document
        .elementFromPoint(point.clientX, point.clientY)
        ?.closest("[data-toolbox-dropzone]");
      if (!droppedOnToolbox) return;

      setNodes((currentNodes) => currentNodes.filter((n) => n.id !== node.id));
      setEdges((currentEdges) =>
        currentEdges.filter(
          (e) => e.source !== node.id && e.target !== node.id,
        ),
      );
    },
    [setNodes, setEdges],
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onNodeContextMenu={onNodeContextMenu}
        onNodeDragStop={onNodeDragStop}
        // ノードをドラッグし始めた時点で、そのノードを選択状態にする(React Flowの既定動作を明示)
        selectNodesOnDrag
        // ノードをpane端付近までドラッグすると自動でビューポートがパンする既定機能を無効化。
        // 有効のままだと、ツールボックスへドラッグして捨てたいときにパンと引っ張り合いになり、
        // カーソルを狙った位置まで持っていけなくなるため。
        autoPanOnNodeDrag={false}
        // ワイヤーは曲線ではなく直線でつなぐ。見やすい濃い色にする既定スタイルも合わせて指定(確定済みのワイヤー用)
        defaultEdgeOptions={{
          type: "straight",
          style: { stroke: "#111827", strokeWidth: 2 },
        }}
        // 配線中(まだ確定していない)の仮の線も、確定後と同じ直線・色・太さにする
        connectionLineType={ConnectionLineType.Straight}
        connectionLineStyle={{ stroke: "#111827", strokeWidth: 2 }}
        // 素子の端子には向き（＋極／－極のような接続の向き）を区別させたくないため、
        // source 側同士・target 側同士でも接続できる Loose モードにしている。
        connectionMode={ConnectionMode.Loose}
        fitView
      >
        {/* 方眼状のドット背景（回路メーカーエリアの位置感覚をつかみやすくするための飾り） */}
        <Background />
        {/* 右下に表示される、拡大・縮小・全体表示ボタン */}
        <Controls />

        {/* 左上: 操作モード(編集/消しゴム)の切り替え。キャンバス上に浮かせて目立たせる */}
        <Panel position="top-left" className={FLOATING_PANEL_CLASS}>
          {MODE_OPTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              title={label}
              aria-label={label}
              aria-pressed={mode === id}
              className={
                mode === id ? FLOATING_BUTTON_ACTIVE_CLASS : FLOATING_BUTTON_CLASS
              }
            >
              <Icon />
            </button>
          ))}
        </Panel>

        {/* 右上: 回路を一括で消去するクリアボタン */}
        <Panel position="top-right" className={FLOATING_PANEL_CLASS}>
          <button
            type="button"
            onClick={handleClear}
            className={FLOATING_BUTTON_CLASS}
          >
            クリア
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}
