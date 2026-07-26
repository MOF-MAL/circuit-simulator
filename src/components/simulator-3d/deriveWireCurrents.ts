import { terminalKey } from "@/lib/circuit-solver/topology";
import type { SimulationSnapshot } from "@/lib/circuit-solver/types";
import type { CircuitLayout, WireLayout } from "./use3DCircuitLayout";

/**
 * 素子を流れる電流(SimulationSnapshot.elementCurrents)から、配線(ワイヤー)を流れる電流を
 * 表示のたびに導出する。配線ごとの電流はsolver側では計算・保存しない(分岐点の電流配分は
 * 素子の電流だけからは一意に決まらないため、電流モード表示専用の簡易な近似として
 * ここで都度計算し、保存はしない)。
 *
 * 考え方: 配線は理想導体(無抵抗)なので、1つの電気的ネットの中の配線だけを見れば
 * 「素子の電流をネットへの注入量として、配線という枝に流す」木構造の電流分配問題になる。
 * ネット内の配線グラフから全域木を作り、各枝の電流を「その先(葉側)の部分木に
 * 流入する電流の合計」として求める。全域木からあふれた配線(閉路を作る冗長な配線)は、
 * 理想配線どうしでは電流配分が物理的に不定なため、電流0として扱う。
 */
export function deriveWireCurrents(
  layout: CircuitLayout,
  snapshot: SimulationSnapshot,
): Map<string, number> {
  const injectionByTerminal = new Map<string, number>();

  for (const element of layout.elements) {
    const current = snapshot.elementCurrents[element.id];
    if (current === undefined) continue;
    const { elementType, params } = element.node.data;

    let aHandle: string;
    let bHandle: string;
    if (elementType === "ground") {
      continue;
    } else if (elementType === "switch-b") {
      const connected = Number(params.connectedTerminal) || 0;
      if (connected === 0) continue;
      aHandle = "common";
      bHandle = `t${connected}`;
    } else {
      aHandle = "a";
      bHandle = "b";
    }

    // solver.tsの規約: elementCurrentsは「a端子からb端子へ素子を流れる電流」。
    // ネットへの注入量としては、a端子ではネットから素子へ流出(-I)、b端子では素子からネットへ流入(+I)。
    const aKey = terminalKey(element.id, aHandle);
    const bKey = terminalKey(element.id, bHandle);
    injectionByTerminal.set(
      aKey,
      (injectionByTerminal.get(aKey) ?? 0) - current,
    );
    injectionByTerminal.set(
      bKey,
      (injectionByTerminal.get(bKey) ?? 0) + current,
    );
  }

  const wiresByNet = new Map<string, WireLayout[]>();
  for (const wire of layout.wires) {
    const list = wiresByNet.get(wire.netId);
    if (list) list.push(wire);
    else wiresByNet.set(wire.netId, [wire]);
  }

  const result = new Map<string, number>();

  for (const wires of wiresByNet.values()) {
    type AdjacencyEntry = { neighborKey: string; wire: WireLayout };
    const adjacency = new Map<string, AdjacencyEntry[]>();
    const addDirectedEdge = (from: string, to: string, wire: WireLayout) => {
      const list = adjacency.get(from);
      const entry = { neighborKey: to, wire };
      if (list) list.push(entry);
      else adjacency.set(from, [entry]);
    };
    for (const wire of wires) {
      addDirectedEdge(wire.fromTerminalKey, wire.toTerminalKey, wire);
      addDirectedEdge(wire.toTerminalKey, wire.fromTerminalKey, wire);
    }

    const visited = new Set<string>();
    // BFS発見順(root→葉の順)。この順の逆順で辿ると、必ず子を親より先に処理できる。
    const discoveryOrder: string[] = [];
    const parentOf = new Map<string, { key: string; wire: WireLayout }>();

    for (const startKey of adjacency.keys()) {
      if (visited.has(startKey)) continue;
      visited.add(startKey);
      const queue = [startKey];
      while (queue.length > 0) {
        const currentKey = queue.shift() as string;
        discoveryOrder.push(currentKey);
        for (const { neighborKey, wire } of adjacency.get(currentKey) ?? []) {
          if (visited.has(neighborKey)) continue; // 非木の辺(閉路)はここで捨てる
          visited.add(neighborKey);
          parentOf.set(neighborKey, { key: currentKey, wire });
          queue.push(neighborKey);
        }
      }
    }

    const subtreeSum = new Map<string, number>();
    for (const key of discoveryOrder) {
      subtreeSum.set(key, injectionByTerminal.get(key) ?? 0);
    }
    for (let i = discoveryOrder.length - 1; i >= 0; i--) {
      const key = discoveryOrder[i];
      const parent = parentOf.get(key);
      if (!parent) continue;
      subtreeSum.set(
        parent.key,
        (subtreeSum.get(parent.key) ?? 0) + (subtreeSum.get(key) ?? 0),
      );
    }

    for (const key of discoveryOrder) {
      const parent = parentOf.get(key);
      if (!parent) continue;
      const childSum = subtreeSum.get(key) ?? 0;
      // 配線自体の向き(fromTerminalKey→toTerminalKey)に対して、
      // 子側(key)がfromならそのままの向き、toなら逆向きの電流になる。
      const sign = parent.wire.fromTerminalKey === key ? 1 : -1;
      result.set(parent.wire.edgeId, sign * childSum);
    }
  }

  return result;
}
