/**
 * 回路シミュレーション(MNA + 後退オイラー法)の計算結果に関する型定義。
 */

/** 1時刻ぶんのシミュレーション結果 */
export type SimulationSnapshot = {
  timeSec: number;
  /** 電気的節点ID("ground"を含む) → 電位(V) */
  nodeVoltages: Record<string, number>;
  /** 素子ノードID → その素子の両端の電圧差(V) */
  elementVoltages: Record<string, number>;
  /** 素子ノードID → その素子を流れる電流(A)。値が定義できない素子は含まれない。 */
  elementCurrents: Record<string, number>;
};

/**
 * 後退オイラー法の逐次計算を続きから再開するための状態(コンデンサ電圧・コイル電流)。
 * ノードID → 直近の値。過去のスナップショットを保持していなくても、この状態さえあれば
 * 続きのステップを計算できる(キャッシュのスライド窓の外側を捨てられる理由)。
 */
export type SolverState = {
  capacitorVoltage: Map<string, number>;
  inductorCurrent: Map<string, number>;
};

/** runSimulationの結果。回路が解けない場合はok:falseで理由を返す(例外は投げない)。 */
export type SimulationResult =
  | { ok: true; snapshots: SimulationSnapshot[]; finalState: SolverState }
  | { ok: false; reason: string };
