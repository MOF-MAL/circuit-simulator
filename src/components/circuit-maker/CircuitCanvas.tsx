"use client";

import {
  addEdge,
  Background,
  type Connection,
  ConnectionMode,
  Controls,
  type Edge,
  type NodeMouseHandler,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
// React Flow 本体の見た目（ノードの枠線・線の描画など）に必要なCSS。
// Tailwind CSS のクラスと衝突しないよう、React Flow を実際に使うこのファイルの中だけで読み込む。
import "@xyflow/react/dist/style.css";
import { type DragEvent, useCallback } from "react";
import {
  CIRCUIT_ELEMENT_DRAG_DATA_KEY,
  CIRCUIT_ELEMENT_TYPES,
  type CircuitElementType,
  createDefaultParams,
} from "./circuit-elements";
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

/** 起動時から回路メーカーエリアに置いておく、電位の基準となるアース */
const INITIAL_NODES: CircuitElementNodeType[] = [
  {
    id: "ground-default",
    type: "circuitElement",
    position: { x: 40, y: 40 },
    data: {
      elementType: "ground",
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
 * 実際の回路計算（MNAなど）はまだ行っていない。
 * 今のところは「素子を自由に配置して線でつなぐ・回転させる」という見た目・操作性のみを実現している。
 */
export function CircuitCanvas() {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<CircuitElementNodeType>(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  // screenToFlowPosition: 画面上の座標（ドロップした場所）を、
  // キャンバスの拡大縮小・スクロールを考慮した「キャンバス内部の座標」に変換してくれる関数。
  const { screenToFlowPosition, getNodes } =
    useReactFlow<CircuitElementNodeType>();

  // ツールボックスの素子をキャンバス上にドラッグしている間、常に呼ばれる。
  // ここで event.preventDefault() をしないと、ブラウザが「ドロップ不可」として扱ってしまう。
  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // ツールボックスの素子をキャンバス上でマウスを離した（ドロップした）瞬間に呼ばれる。
  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      // Toolbox 側の onDragStart でセットした「どの素子か」を取り出す
      const elementType = event.dataTransfer.getData(
        CIRCUIT_ELEMENT_DRAG_DATA_KEY,
      ) as CircuitElementType | "";
      if (!elementType) return;

      // maxCountが設定されている素子(アースなど)は、Toolbox側のdraggable無効化を
      // すり抜けてドロップされた場合に備えて、ここでも上限を防御的にチェックする
      const maxCount = CIRCUIT_ELEMENT_TYPES.find(
        (t) => t.id === elementType,
      )?.maxCount;
      if (maxCount !== undefined) {
        const currentCount = getNodes().filter(
          (node) => node.data.elementType === elementType,
        ).length;
        if (currentCount >= maxCount) return;
      }

      // ドロップされた画面座標を、キャンバス内部の座標に変換する
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // 新しく配置する素子を選択状態にしたいので、他ノードは選択解除しつつ追加する
      // （addNodesではなく、直接setNodesで1回にまとめて反映している）。
      setNodes((currentNodes) => [
        ...currentNodes.map((n) => ({ ...n, selected: false })),
        {
          id: crypto.randomUUID(),
          type: "circuitElement" as const,
          position,
          // 新しく配置する素子は、常に回転なし(0度)＋各素子のデフォルト値から始める
          data: {
            elementType,
            rotation: 0 as const,
            params: createDefaultParams(elementType),
          },
          selected: true,
        },
      ]);
    },
    [screenToFlowPosition, setNodes, getNodes],
  );

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
    // biome-ignore lint/a11y/noStaticElementInteractions: ドロップゾーン(D&D受け皿)であり、クリック/キー操作の対象ではないため適切なroleが存在しない
    <div className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onNodeDragStop={onNodeDragStop}
        // ノードをドラッグし始めた時点で、そのノードを選択状態にする(React Flowの既定動作を明示)
        selectNodesOnDrag
        // ノードをpane端付近までドラッグすると自動でビューポートがパンする既定機能を無効化。
        // 有効のままだと、ツールボックスへドラッグして捨てたいときにパンと引っ張り合いになり、
        // カーソルを狙った位置まで持っていけなくなるため。
        autoPanOnNodeDrag={false}
        // ワイヤーを見やすい濃い色にする既定スタイル(確定済みのワイヤー用)
        defaultEdgeOptions={{ style: { stroke: "#111827", strokeWidth: 2 } }}
        // 配線中(まだ確定していない)の仮の線も、確定後と同じ色・太さにする
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
      </ReactFlow>
    </div>
  );
}
