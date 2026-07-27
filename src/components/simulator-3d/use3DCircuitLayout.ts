"use client";

import { type Edge, useEdges, useNodes } from "@xyflow/react";
import { useMemo } from "react";
import type { CircuitElementNodeType } from "@/components/circuit-maker/nodes/CircuitElementNode";
import {
  buildElectricalNodes,
  getHandleIds,
  terminalKey,
} from "@/lib/circuit-solver/topology";
import {
  elementSizePx,
  flowToWorldXZ,
  terminalAbsolutePosition,
} from "./geometry";

export type TerminalLayout = {
  handleId: string;
  netId: string;
  x: number;
  z: number;
};

export type ElementLayout = {
  id: string;
  node: CircuitElementNodeType;
  /** ノード矩形の中心(px→3Dワールド座標)。スイッチBのハブ表示などに使う */
  center: { x: number; z: number };
  terminals: TerminalLayout[];
  /**
   * 「回路がオンになっている」素子かどうか(電位・電流・電力モードでエフェクトを
   * 表示してよいか)。自分の使う端子が両方とも配線されており、かつ(スイッチAなら)
   * 閉じていることを表す。アース・節点・未接続のスイッチBはgetElementEndpointsが
   * 既にnullを返すため、そもそも常にfalseになる。
   */
  active: boolean;
};

export type WireLayout = {
  edgeId: string;
  netId: string;
  /** "ノードID:ハンドルID"形式。deriveWireCurrentsが配線どうしの接続関係を辿るのに使う */
  fromTerminalKey: string;
  toTerminalKey: string;
  from: { x: number; z: number };
  to: { x: number; z: number };
};

export type CircuitLayout = {
  elements: ElementLayout[];
  wires: WireLayout[];
};

/**
 * 回路メーカーの2Dレイアウト(nodes/edges)から、3Dシーンで使う静的な配置情報を作る。
 * nodes/edgesだけに依存し、currentSnapshot(電位・電流の毎ティックの値)には依存しない。
 * こうしておくことで、シミュレーション再生中でも配線・素子の位置の再計算(Union-Findのやり直し)
 * が毎フレーム走らないようにしている。動的な値は各モードコンポーネント側で別途参照する。
 */
export function use3DCircuitLayout(): CircuitLayout {
  const nodes = useNodes<CircuitElementNodeType>();
  const edges = useEdges();

  return useMemo(() => {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const terminalToNet = buildElectricalNodes(nodes, edges);
    const netOf = (nodeId: string, handleId: string) =>
      terminalToNet.get(terminalKey(nodeId, handleId)) ??
      terminalKey(nodeId, handleId);

    const elements: ElementLayout[] = nodes.map((node) => {
      const terminals = getHandleIds(node).map((handleId) => {
        const [x, z] = flowToWorldXZ(terminalAbsolutePosition(node, handleId));
        return { handleId, netId: netOf(node.id, handleId), x, z };
      });
      const sizePx = elementSizePx(node.data.elementType);
      const [centerX, centerZ] = flowToWorldXZ({
        x: node.position.x + sizePx / 2,
        y: node.position.y + sizePx / 2,
      });
      const partial = {
        id: node.id,
        node,
        center: { x: centerX, z: centerZ },
        terminals,
      };
      return { ...partial, active: isElementActive(partial, edges) };
    });

    const wires: WireLayout[] = edges.flatMap((edge) => {
      const sourceNode = nodeById.get(edge.source);
      const targetNode = nodeById.get(edge.target);
      if (!sourceNode || !targetNode) return [];
      const fromHandle = edge.sourceHandle ?? "a";
      const toHandle = edge.targetHandle ?? "a";
      const [fromX, fromZ] = flowToWorldXZ(
        terminalAbsolutePosition(sourceNode, fromHandle),
      );
      const [toX, toZ] = flowToWorldXZ(
        terminalAbsolutePosition(targetNode, toHandle),
      );
      return [
        {
          edgeId: edge.id,
          netId: netOf(edge.source, fromHandle),
          fromTerminalKey: terminalKey(edge.source, fromHandle),
          toTerminalKey: terminalKey(edge.target, toHandle),
          from: { x: fromX, z: fromZ },
          to: { x: toX, z: toZ },
        },
      ];
    });

    return { elements, wires };
  }, [nodes, edges]);
}

/**
 * 素子の「a端子・b端子」を求める(solver.tsのgetEndpointsと同じ規約)。
 * アース(1端子)や、未接続のスイッチBはnullを返す(電気的な区間が定義できないため)。
 * 電位・電流・電力の各モードで、素子を1本の区間として扱うときに共通して使う。
 */
export function getElementEndpoints(
  element: Pick<ElementLayout, "node" | "terminals">,
): { a: TerminalLayout; b: TerminalLayout } | null {
  const { elementType, params } = element.node.data;
  if (elementType === "ground") return null;

  if (elementType === "switch-b") {
    const connected = Number(params.connectedTerminal) || 0;
    if (connected === 0) return null;
    const a = element.terminals.find((t) => t.handleId === "common");
    const b = element.terminals.find((t) => t.handleId === `t${connected}`);
    return a && b ? { a, b } : null;
  }

  const [a, b] = element.terminals;
  return a && b ? { a, b } : null;
}

/**
 * 「回路がオンになっている」素子かどうか: 自分が使う端子(a/b、スイッチBならcommon/
 * 接続中の端子)の両方に実際にワイヤーが1本以上つながっており、かつスイッチAなら
 * 閉じていること。電位・電流・電力モードで、非アクティブな素子にはエフェクトを
 * 表示しないようにするための判定(ループ途中の別の素子までは連動させない、素子単体の判定)。
 */
function isElementActive(
  element: Pick<ElementLayout, "id" | "node" | "terminals">,
  edges: Edge[],
): boolean {
  const endpoints = getElementEndpoints(element);
  if (!endpoints) return false;
  const { elementType, params } = element.node.data;
  if (elementType === "switch-a" && !params.closed) return false;
  const isWired = (handleId: string) =>
    edges.some(
      (e) =>
        (e.source === element.id && e.sourceHandle === handleId) ||
        (e.target === element.id && e.targetHandle === handleId),
    );
  return isWired(endpoints.a.handleId) && isWired(endpoints.b.handleId);
}
