import type { Edge } from "@xyflow/react";
import type { CircuitElementNodeType } from "@/components/circuit-maker/nodes/CircuitElementNode";

/** 素子の端子を一意に表す文字列キー("ノードID:ハンドルID") */
export type TerminalKey = string;

export function terminalKey(nodeId: string, handleId: string): TerminalKey {
  return `${nodeId}:${handleId}`;
}

/** 素子の種類ごとに、端子のハンドルIDの一覧を返す(CircuitElementNode.tsxの描画と対応させる) */
export function getHandleIds(node: CircuitElementNodeType): string[] {
  if (node.data.elementType === "ground") return ["a"];
  if (node.data.elementType === "switch-b") {
    const terminalCount = Math.max(
      1,
      Number(node.data.params.terminalCount) || 1,
    );
    return [
      "common",
      ...Array.from({ length: terminalCount }, (_, i) => `t${i + 1}`),
    ];
  }
  return ["a", "b"];
}

/**
 * ワイヤー(エッジ)でつながっている端子どうしを、1つの「電気的節点」としてまとめる
 * (Union-Find)。アースの端子を含むグループには、基準0Vを表す固定ID "ground" を割り当てる。
 *
 * 戻り値は、端子キー("ノードID:ハンドルID") → 電気的節点ID のマップ。
 */
export function buildElectricalNodes(
  nodes: CircuitElementNodeType[],
  edges: Edge[],
): Map<TerminalKey, string> {
  const parent = new Map<TerminalKey, TerminalKey>();
  const find = (key: TerminalKey): TerminalKey => {
    if (!parent.has(key)) parent.set(key, key);
    let root = key;
    while (parent.get(root) !== root) root = parent.get(root) as TerminalKey;
    parent.set(key, root); // 経路圧縮
    return root;
  };
  const union = (a: TerminalKey, b: TerminalKey) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  // すべての端子をUnion-Findに登録しておく(ワイヤーがつながっていない孤立端子も含む)
  for (const node of nodes) {
    for (const handleId of getHandleIds(node))
      find(terminalKey(node.id, handleId));
  }

  for (const edge of edges) {
    const a = terminalKey(edge.source, edge.sourceHandle ?? "a");
    const b = terminalKey(edge.target, edge.targetHandle ?? "a");
    union(a, b);
  }

  const groundNodeId = nodes.find((n) => n.data.elementType === "ground")?.id;
  const groundRoot = groundNodeId
    ? find(terminalKey(groundNodeId, "a"))
    : undefined;

  const result = new Map<TerminalKey, string>();
  for (const key of parent.keys()) {
    const root = find(key);
    result.set(key, root === groundRoot ? "ground" : root);
  }
  return result;
}
