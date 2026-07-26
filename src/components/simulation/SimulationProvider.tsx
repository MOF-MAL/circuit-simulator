"use client";

import { type Edge, useEdges, useNodes } from "@xyflow/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CircuitElementNodeType } from "@/components/circuit-maker/nodes/CircuitElementNode";
import {
  createInitialSolverState,
  runSimulation,
} from "@/lib/circuit-solver/solver";
import type {
  SimulationSnapshot,
  SolverState,
} from "@/lib/circuit-solver/types";

/** 時間刻み(秒)。既定のRC(100Ω×1μF→時定数0.1ms)・RL(1mH/100Ω→時定数10μs)でも粗すぎない細かさ。 */
const TIME_STEP_SEC = 5e-6;
/** 再生位置から常にこの秒数ぶん先まで、先読みキャッシュしておく(既定の交流電源50Hz→周期20ms) */
const FUTURE_WINDOW_SEC = 0.01;
/** 再生位置より前も、この秒数ぶんだけ遡れるように保持しておく */
const PAST_WINDOW_SEC = 0.005;
/** 実時間1秒あたりに進めるシミュレーション時間(秒)。既定を100倍のスローモーションにする。 */
const PLAYBACK_SPEED = 0.01;
/** 素子パラメータ編集中の連続再計算を防ぐための、再計算までの待ち時間(ms) */
const RECOMPUTE_DEBOUNCE_MS = 150;

type SimulationContextValue = {
  currentSnapshot: SimulationSnapshot | null;
  /** 回路が解けない場合の理由(解ければnull) */
  errorReason: string | null;
  currentTimeSec: number;
  /** 保持している窓の始点・終点(秒) */
  windowStartSec: number;
  cachedDurationSec: number;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  seek: (timeSec: number) => void;
};

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function useSimulation(): SimulationContextValue {
  const value = useContext(SimulationContext);
  if (!value) {
    throw new Error(
      "useSimulationはSimulationProviderの内側でのみ使用できます",
    );
  }
  return value;
}

/** 「時刻uptoSecまで見える」ように、時刻0から作り直した窓を計算する(トポロジー変更時・大きく遡るシーク時に使う) */
function computeFreshWindow(
  nodes: CircuitElementNodeType[],
  edges: Edge[],
  uptoSec: number,
) {
  const initialState = createInitialSolverState(nodes);
  const stepCount = Math.max(
    1,
    Math.round((uptoSec + FUTURE_WINDOW_SEC) / TIME_STEP_SEC),
  );
  return runSimulation(nodes, edges, TIME_STEP_SEC, 0, stepCount, initialState);
}

/**
 * 回路のトポロジー・パラメータからシミュレーション結果(後退オイラー法)を計算し、
 * 「現在の再生位置から少し過去～少し未来」だけをスライド窓としてキャッシュしつつ、
 * タイムマネージャーUI・回路データエリアに配布するコンテキスト。
 *
 * 後退オイラー法は逐次計算(各ステップが直前の状態に依存)なので、過去のスナップショットを
 * 保持しなくても、直近のコンデンサ電圧・コイル電流(チェックポイント)さえ覚えておけば
 * 続きから計算を再開できる。これにより、再生をどれだけ続けても保持するデータ量は一定に保たれる。
 */
export function SimulationProvider({ children }: { children: ReactNode }) {
  const nodes = useNodes<CircuitElementNodeType>();
  const edges = useEdges();

  const [snapshots, setSnapshots] = useState<SimulationSnapshot[]>([]);
  const [windowStartSec, setWindowStartSec] = useState(0);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  // 窓の続きを計算するためのチェックポイント(直近のコンデンサ電圧・コイル電流)
  const checkpointRef = useRef<{ timeSec: number; state: SolverState } | null>(
    null,
  );

  // ノード・エッジの「内容」が変わったときだけ再計算したいので、参照ではなく
  // 内容の文字列表現を依存値にする(位置のドラッグ中などの再レンダリングでは再計算しない)。
  const circuitFingerprint = useMemo(
    () =>
      JSON.stringify(nodes.map((n) => ({ id: n.id, data: n.data }))) +
      JSON.stringify(
        edges.map((e) => ({
          s: e.source,
          sh: e.sourceHandle,
          t: e.target,
          th: e.targetHandle,
        })),
      ),
    [nodes, edges],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: circuitFingerprintで内容の変化を判定しているため、nodes/edges自体は依存に入れない
  useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentTimeSec(0);
      setWindowStartSec(0);
      const result = computeFreshWindow(nodes, edges, 0);
      if (result.ok) {
        setSnapshots(result.snapshots);
        setErrorReason(null);
        checkpointRef.current = {
          timeSec: (result.snapshots.length - 1) * TIME_STEP_SEC,
          state: result.finalState,
        };
      } else {
        setSnapshots([]);
        setErrorReason(result.reason);
        checkpointRef.current = null;
      }
    }, RECOMPUTE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [circuitFingerprint]);

  // 現在の再生位置に応じて、窓を前後にスライドさせる
  // (末尾が足りなければチェックポイントから延長、先頭が古すぎれば切り捨てる)。
  const slideWindow = useCallback(
    (targetTimeSec: number) => {
      // 保持している窓より前に戻ろうとした場合は、そこを新たな時刻0とみなして作り直す
      if (targetTimeSec < windowStartSec) {
        const result = computeFreshWindow(nodes, edges, targetTimeSec);
        if (result.ok) {
          setSnapshots(result.snapshots);
          setWindowStartSec(0);
          setErrorReason(null);
          checkpointRef.current = {
            timeSec: (result.snapshots.length - 1) * TIME_STEP_SEC,
            state: result.finalState,
          };
        }
        return;
      }

      setSnapshots((current) => {
        const cachedEndSec = windowStartSec + current.length * TIME_STEP_SEC;
        if (
          targetTimeSec + FUTURE_WINDOW_SEC <= cachedEndSec ||
          !checkpointRef.current
        ) {
          return current;
        }
        const additionalStepCount = Math.round(
          (targetTimeSec + FUTURE_WINDOW_SEC - cachedEndSec) / TIME_STEP_SEC,
        );
        if (additionalStepCount <= 0) return current;
        const result = runSimulation(
          nodes,
          edges,
          TIME_STEP_SEC,
          checkpointRef.current.timeSec + TIME_STEP_SEC,
          additionalStepCount,
          checkpointRef.current.state,
        );
        if (!result.ok) return current;
        checkpointRef.current = {
          timeSec:
            checkpointRef.current.timeSec + additionalStepCount * TIME_STEP_SEC,
          state: result.finalState,
        };
        const extended = [...current, ...result.snapshots];

        // 先頭のうち、再生位置よりPAST_WINDOW_SECより古い分は捨てる
        const dropCount = Math.max(
          0,
          Math.floor(
            (targetTimeSec - PAST_WINDOW_SEC - windowStartSec) / TIME_STEP_SEC,
          ),
        );
        if (dropCount > 0) {
          setWindowStartSec((start) => start + dropCount * TIME_STEP_SEC);
          return extended.slice(dropCount);
        }
        return extended;
      });
    },
    [nodes, edges, windowStartSec],
  );

  // 再生中は、実時間の経過に合わせて再生位置(currentTimeSec)をスローモーションで進める
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isPlaying) return;
    let last = performance.now();
    const tick = (now: number) => {
      const deltaSec = ((now - last) / 1000) * PLAYBACK_SPEED;
      last = now;
      setCurrentTimeSec((current) => current + deltaSec);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  // slideWindowはwindowStartSecに依存しているが、それをここでも依存に含めると
  // 窓が動くたびに不要な二重実行が起きるため、currentTimeSecの変化のみをトリガーにする
  // biome-ignore lint/correctness/useExhaustiveDependencies: 上記コメントの通り、意図的にcurrentTimeSecのみを依存にしている
  useEffect(() => {
    slideWindow(currentTimeSec);
  }, [currentTimeSec]);

  const seek = useCallback((timeSec: number) => {
    setCurrentTimeSec(Math.max(0, timeSec));
  }, []);

  const currentSnapshot = useMemo(() => {
    if (snapshots.length === 0) return null;
    const stepIndex = Math.min(
      snapshots.length - 1,
      Math.max(
        0,
        Math.round((currentTimeSec - windowStartSec) / TIME_STEP_SEC),
      ),
    );
    return snapshots[stepIndex];
  }, [snapshots, currentTimeSec, windowStartSec]);

  const value: SimulationContextValue = {
    currentSnapshot,
    errorReason,
    currentTimeSec,
    windowStartSec,
    cachedDurationSec: windowStartSec + snapshots.length * TIME_STEP_SEC,
    isPlaying,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    seek,
  };

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}
