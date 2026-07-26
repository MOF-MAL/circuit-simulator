import type { Edge } from "@xyflow/react";
import * as math from "mathjs";
import type { CircuitElementNodeType } from "@/components/circuit-maker/nodes/CircuitElementNode";
import { buildElectricalNodes, terminalKey } from "./topology";
import type {
  SimulationResult,
  SimulationSnapshot,
  SolverState,
} from "./types";

/** スイッチの導通/非導通を近似する抵抗値(理想スイッチを厳密に扱うと式が複雑になるための簡略化) */
const SWITCH_ON_RESISTANCE = 1e-6;
const SWITCH_OFF_RESISTANCE = 1e9;

type Endpoints = { a: string; b: string };

/** 2端子ぶんの電気的節点を返す(スイッチBは現在接続中の端子、未接続なら回路に影響しないのでundefined) */
function getEndpoints(
  node: CircuitElementNodeType,
  netOf: (nodeId: string, handleId: string) => string,
): Endpoints | undefined {
  const { elementType } = node.data;
  if (elementType === "ground") return undefined;
  if (elementType === "switch-b") {
    const connected = Number(node.data.params.connectedTerminal) || 0;
    if (connected === 0) return undefined;
    return { a: netOf(node.id, "common"), b: netOf(node.id, `t${connected}`) };
  }
  return { a: netOf(node.id, "a"), b: netOf(node.id, "b") };
}

/**
 * コンデンサの初期電荷(初期電圧 = 電荷/静電容量)だけをシードした、
 * 時刻0時点の後退オイラー法の状態を作る(コイルの初期電流は常に0)。
 */
export function createInitialSolverState(
  nodes: CircuitElementNodeType[],
): SolverState {
  const capacitorVoltage = new Map<string, number>();
  for (const node of nodes) {
    if (node.data.elementType !== "capacitor") continue;
    const c = Number(node.data.params.capacitance) || 1e-12;
    const q0 = Number(node.data.params.initialCharge) || 0;
    capacitorVoltage.set(node.id, q0 / c);
  }
  return { capacitorVoltage, inductorCurrent: new Map() };
}

/**
 * 既に計算済みのスナップショット(ある時刻の断面)から、その時刻時点の後退オイラー法の状態を
 * 復元する。コンデンサ電圧・コイル電流は連続量(トポロジーが変わっても瞬間的には変化しない)なので、
 * スイッチの状態だけが変わったタイミングでその時刻から計算を続けたい場合、この状態を
 * 新しいトポロジー(切り替え後のスイッチ状態)でのrunSimulationの初期状態として渡せばよい。
 */
export function solverStateFromSnapshot(
  nodes: CircuitElementNodeType[],
  snapshot: SimulationSnapshot,
): SolverState {
  const capacitorVoltage = new Map<string, number>();
  const inductorCurrent = new Map<string, number>();
  for (const node of nodes) {
    if (node.data.elementType === "capacitor") {
      capacitorVoltage.set(node.id, snapshot.elementVoltages[node.id] ?? 0);
    } else if (node.data.elementType === "inductor") {
      inductorCurrent.set(node.id, snapshot.elementCurrents[node.id] ?? 0);
    }
  }
  return { capacitorVoltage, inductorCurrent };
}

/**
 * 現在のトポロジー・素子パラメータで、startTimeSecからstepCountステップぶんの
 * 後退オイラー法シミュレーションを実行する。initialStateには、直前までの
 * コンデンサ電圧・コイル電流(createInitialSolverStateで作った初期状態、または
 * 前回のrunSimulationが返したfinalState)を渡す。これにより、過去の全履歴を
 * 保持しなくても「続きから」計算を再開できる(キャッシュのスライド窓を実現する肝)。
 *
 * MNA(修正節点解析)の考え方: 電気的節点ごとに「流入電流の合計=0」の式を1本作り、
 * 直流電源・交流電源・理想電流計(内部抵抗0)は電圧を固定するため、
 * 「その素子を流れる電流」を未知数として追加する(標準的なMNAの手法)。
 * コンデンサ・コイルは、前ステップの状態を使った等価抵抗+電流源(伴等回路)に
 * 置き換えることで、毎ステップ「抵抗と電流源だけの回路」として解く。
 */
export function runSimulation(
  nodes: CircuitElementNodeType[],
  edges: Edge[],
  dtSec: number,
  startTimeSec: number,
  stepCount: number,
  initialState: SolverState,
): SimulationResult {
  if (!nodes.some((n) => n.data.elementType === "ground")) {
    return { ok: false, reason: "アースが配置されていません" };
  }

  const terminalToNet = buildElectricalNodes(nodes, edges);
  const netOf = (nodeId: string, handleId: string) =>
    terminalToNet.get(terminalKey(nodeId, handleId)) ??
    terminalKey(nodeId, handleId);

  // "ground"以外の電気的節点に、行列上の添字(0始まり)を割り振る
  const netIds = Array.from(new Set(terminalToNet.values())).filter(
    (id) => id !== "ground",
  );
  const netIndex = new Map(netIds.map((id, i) => [id, i]));
  const idx = (net: string): number | undefined =>
    net === "ground" ? undefined : netIndex.get(net);

  // 電圧を固定する(=流れる電流を未知数として追加する)素子: 直流電源・交流電源・理想電流計
  const voltageSourceNodes = nodes.filter((n) => {
    if (
      n.data.elementType === "dc-source" ||
      n.data.elementType === "ac-source"
    )
      return true;
    if (n.data.elementType === "ammeter")
      return (Number(n.data.params.internalResistance) || 0) === 0;
    return false;
  });
  const sourceIndex = new Map(voltageSourceNodes.map((n, i) => [n.id, i]));

  const dim = netIds.length + voltageSourceNodes.length;
  if (dim === 0) {
    return { ok: false, reason: "計算対象の素子がありません" };
  }

  // コンデンサの前回電圧・コイルの前回電流(後退オイラー法の伴等回路に使う、ノードIDごとの状態)。
  // initialStateを書き換えないよう複製してから使う。
  const capacitorVoltage = new Map(initialState.capacitorVoltage);
  const inductorCurrent = new Map(initialState.inductorCurrent);

  const snapshots: SimulationSnapshot[] = [];

  for (let step = 0; step < stepCount; step++) {
    const timeSec = startTimeSec + step * dtSec;
    const G: number[][] = Array.from({ length: dim }, () =>
      new Array(dim).fill(0),
    );
    const z: number[] = new Array(dim).fill(0);

    const stampConductance = (a: string, b: string, conductance: number) => {
      const ia = idx(a);
      const ib = idx(b);
      if (ia !== undefined) G[ia][ia] += conductance;
      if (ib !== undefined) G[ib][ib] += conductance;
      if (ia !== undefined && ib !== undefined) {
        G[ia][ib] -= conductance;
        G[ib][ia] -= conductance;
      }
    };
    const injectCurrent = (net: string, amount: number) => {
      const i = idx(net);
      if (i !== undefined) z[i] += amount;
    };
    const stampVoltageSource = (
      a: string,
      b: string,
      sourceRow: number,
      voltage: number,
    ) => {
      const row = netIds.length + sourceRow;
      const ia = idx(a);
      const ib = idx(b);
      if (ia !== undefined) {
        G[ia][row] += 1;
        G[row][ia] += 1;
      }
      if (ib !== undefined) {
        G[ib][row] -= 1;
        G[row][ib] -= 1;
      }
      z[row] = voltage;
    };

    for (const node of nodes) {
      const endpoints = getEndpoints(node, netOf);
      if (!endpoints) continue;
      const { a, b } = endpoints;
      const { elementType, params } = node.data;

      switch (elementType) {
        case "resistor":
          stampConductance(a, b, 1 / (Number(params.resistance) || 1e-9));
          break;
        case "voltmeter":
          stampConductance(
            a,
            b,
            1 / (Number(params.internalResistance) || 1e-9),
          );
          break;
        case "switch-a":
          stampConductance(
            a,
            b,
            1 / (params.closed ? SWITCH_ON_RESISTANCE : SWITCH_OFF_RESISTANCE),
          );
          break;
        case "switch-b":
          // getEndpointsで未接続は除外済みなので、ここに来るのは常に導通中
          stampConductance(a, b, 1 / SWITCH_ON_RESISTANCE);
          break;
        case "ammeter": {
          const r = Number(params.internalResistance) || 0;
          if (r === 0) {
            const k = sourceIndex.get(node.id);
            // 理想電流計(内部抵抗0)は「0Vの電圧源」として扱う。この電圧源に流れる電流こそが
            // 電流計の測定値そのものになる(電流計をシミュレーションする際の標準的な手法)。
            if (k !== undefined) stampVoltageSource(a, b, k, 0);
          } else {
            stampConductance(a, b, 1 / r);
          }
          break;
        }
        case "dc-source": {
          const k = sourceIndex.get(node.id);
          if (k !== undefined)
            stampVoltageSource(a, b, k, Number(params.voltage) || 0);
          break;
        }
        case "ac-source": {
          const k = sourceIndex.get(node.id);
          const amplitude = Number(params.amplitude) || 0;
          const frequency = Number(params.frequency) || 0;
          const voltage =
            amplitude * Math.sin(2 * Math.PI * frequency * timeSec);
          if (k !== undefined) stampVoltageSource(a, b, k, voltage);
          break;
        }
        case "capacitor": {
          // 後退オイラー法: i_c(t) = Gc*v(t) - Gc*v(t-Δt) となるよう、
          // 導電率Gc(=C/Δt)の抵抗と、前回電圧による電流源を並列に置く
          const gc = (Number(params.capacitance) || 1e-12) / dtSec;
          const vPrev = capacitorVoltage.get(node.id) ?? 0;
          stampConductance(a, b, gc);
          injectCurrent(a, gc * vPrev);
          injectCurrent(b, -gc * vPrev);
          break;
        }
        case "inductor": {
          // 後退オイラー法: i_L(t) = Gl*v(t) + i_L(t-Δt) となるよう、
          // 導電率Gl(=Δt/L)の抵抗と、前回電流による電流源を並列に置く
          const gl = dtSec / (Number(params.inductance) || 1e-9);
          const iPrev = inductorCurrent.get(node.id) ?? 0;
          stampConductance(a, b, gl);
          injectCurrent(a, -iPrev);
          injectCurrent(b, iPrev);
          break;
        }
        default:
          break;
      }
    }

    let solved: number[];
    try {
      const result = math.lusolve(G, z) as unknown as number[][];
      solved = result.map((row) => row[0]);
    } catch {
      return {
        ok: false,
        reason: "回路が閉じていない、または解けない構成です",
      };
    }
    if (solved.some((value) => !Number.isFinite(value))) {
      return {
        ok: false,
        reason: "回路が閉じていない、または解けない構成です",
      };
    }

    const voltageOf = (net: string): number => {
      if (net === "ground") return 0;
      const i = netIndex.get(net);
      return i === undefined ? 0 : solved[i];
    };

    const nodeVoltages: Record<string, number> = { ground: 0 };
    for (const netId of netIds) nodeVoltages[netId] = voltageOf(netId);

    const elementVoltages: Record<string, number> = {};
    const elementCurrents: Record<string, number> = {};

    for (const node of nodes) {
      const endpoints = getEndpoints(node, netOf);
      if (!endpoints) continue;
      const v = voltageOf(endpoints.a) - voltageOf(endpoints.b);
      elementVoltages[node.id] = v;

      const { elementType, params } = node.data;
      if (elementType === "capacitor") {
        const gc = (Number(params.capacitance) || 1e-12) / dtSec;
        const vPrev = capacitorVoltage.get(node.id) ?? 0;
        elementCurrents[node.id] = gc * v - gc * vPrev;
        capacitorVoltage.set(node.id, v);
      } else if (elementType === "inductor") {
        const gl = dtSec / (Number(params.inductance) || 1e-9);
        const iPrev = inductorCurrent.get(node.id) ?? 0;
        const iNow = gl * v + iPrev;
        elementCurrents[node.id] = iNow;
        inductorCurrent.set(node.id, iNow);
      } else if (elementType === "resistor") {
        elementCurrents[node.id] = v / (Number(params.resistance) || 1e-9);
      } else if (elementType === "voltmeter") {
        elementCurrents[node.id] =
          v / (Number(params.internalResistance) || 1e-9);
      } else if (elementType === "switch-a") {
        const r = params.closed ? SWITCH_ON_RESISTANCE : SWITCH_OFF_RESISTANCE;
        elementCurrents[node.id] = v / r;
      } else if (elementType === "switch-b") {
        elementCurrents[node.id] = v / SWITCH_ON_RESISTANCE;
      } else {
        const k = sourceIndex.get(node.id);
        if (k !== undefined)
          elementCurrents[node.id] = solved[netIds.length + k];
      }
    }

    snapshots.push({ timeSec, nodeVoltages, elementVoltages, elementCurrents });
  }

  return {
    ok: true,
    snapshots,
    finalState: { capacitorVoltage, inductorCurrent },
  };
}
