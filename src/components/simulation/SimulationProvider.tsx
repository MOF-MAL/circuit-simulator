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
  solverStateFromSnapshot,
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
/** 実時間1秒あたりに進めるシミュレーション時間(秒)。既定を400倍のスローモーションにする。 */
const PLAYBACK_SPEED = 0.0025;
/** 素子パラメータ編集中の連続再計算を防ぐための、再計算までの待ち時間(ms) */
const RECOMPUTE_DEBOUNCE_MS = 150;

/** snapshots・再生位置・保持窓の開始時刻をまとめて1つのstateにし、常に整合性の取れた形で更新する */
type EngineState = {
  currentTimeSec: number;
  windowStartSec: number;
  snapshots: SimulationSnapshot[];
  errorReason: string | null;
};

const INITIAL_ENGINE_STATE: EngineState = {
  currentTimeSec: 0,
  windowStartSec: 0,
  snapshots: [],
  errorReason: null,
};

type SimulationContextValue = {
  currentSnapshot: SimulationSnapshot | null;
  /** 現在保持している窓ぶんの全スナップショット(グラフ描画用)。時刻順。 */
  snapshots: SimulationSnapshot[];
  /** 回路が解けない場合の理由(解ければnull) */
  errorReason: string | null;
  currentTimeSec: number;
  /** 保持している窓の始点・終点(秒) */
  windowStartSec: number;
  cachedDurationSec: number;
  /**
   * グラフの表示範囲。currentTimeSecだけから毎回導出する値
   * (currentSnapshotと同様に、シーク操作のたびに即座に追従させるため)。
   */
  graphDomainSec: [number, number];
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
 * 表示用のsnapshots配列を「targetTimeSecを基準にした[過去PAST_WINDOW_SEC, 未来FUTURE_WINDOW_SEC]」
 * の範囲だけに切り詰める。一括計算(トポロジー変更・大きなシーク)の結果や、再生ループでの
 * 延長結果に共通して使う。表示用配列を切り詰めても、計算用チェックポイント(SolverState)は
 * 別に保持しているため、続きの計算には影響しない。
 */
function trimToWindow(
  snapshots: SimulationSnapshot[],
  windowStartSec: number,
  targetTimeSec: number,
): { snapshots: SimulationSnapshot[]; windowStartSec: number } {
  const keepFromSec = Math.max(0, targetTimeSec - PAST_WINDOW_SEC);
  const dropCount = Math.max(
    0,
    Math.min(
      snapshots.length,
      Math.round((keepFromSec - windowStartSec) / TIME_STEP_SEC),
    ),
  );
  if (dropCount <= 0) return { snapshots, windowStartSec };
  return {
    snapshots: snapshots.slice(dropCount),
    windowStartSec: windowStartSec + dropCount * TIME_STEP_SEC,
  };
}

function edgesEqual(a: Edge[], b: Edge[]): boolean {
  if (a.length !== b.length) return false;
  const key = (e: Edge) =>
    `${e.source}:${e.sourceHandle}->${e.target}:${e.targetHandle}`;
  const bKeys = new Set(b.map(key));
  return a.every((e) => bKeys.has(key(e)));
}

/** exceptKeys以外のキーがすべて同じ値かどうか(paramsは number | boolean のみなので単純な===比較でよい) */
function paramsEqualExcept(
  a: Record<string, number | boolean>,
  b: Record<string, number | boolean>,
  exceptKeys: string[],
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (exceptKeys.includes(key)) continue;
    if (a[key] !== b[key]) return false;
  }
  return true;
}

type ChangeKind = "none" | "switch" | "topology";

/**
 * 直前に確定させた回路(prev)と現在の回路(next)を比較し、変更の種類を分類する。
 * "switch": 素子の数・配線・スイッチ以外のparamsは一切変わらず、スイッチAの`closed`
 * またはスイッチBの`connectedTerminal`だけが変わった場合。この場合だけ、時刻をリセットせず
 * 現在時刻から新しいスイッチ状態で続きを計算する特別扱いをする(SimulationProvider本体を参照)。
 * それ以外(素子の追加/削除、配線変更、スイッチ以外のparams変更など)は"topology"として、
 * 従来どおり時刻0から作り直す。
 */
function classifyChange(
  prevNodes: CircuitElementNodeType[],
  prevEdges: Edge[],
  nextNodes: CircuitElementNodeType[],
  nextEdges: Edge[],
): ChangeKind {
  if (prevNodes.length !== nextNodes.length) return "topology";
  if (!edgesEqual(prevEdges, nextEdges)) return "topology";

  const prevById = new Map(prevNodes.map((n) => [n.id, n]));
  let sawSwitchChange = false;

  for (const next of nextNodes) {
    const prev = prevById.get(next.id);
    if (!prev) return "topology";
    if (prev.data.elementType !== next.data.elementType) return "topology";
    if (prev.data.rotation !== next.data.rotation) return "topology";
    if (prev.data.params === next.data.params) continue;

    if (next.data.elementType === "switch-a") {
      if (
        prev.data.params.closed === next.data.params.closed ||
        !paramsEqualExcept(prev.data.params, next.data.params, ["closed"])
      ) {
        return "topology";
      }
      sawSwitchChange = true;
    } else if (next.data.elementType === "switch-b") {
      if (
        prev.data.params.connectedTerminal ===
          next.data.params.connectedTerminal ||
        !paramsEqualExcept(prev.data.params, next.data.params, [
          "connectedTerminal",
        ])
      ) {
        return "topology";
      }
      sawSwitchChange = true;
    } else {
      return "topology";
    }
  }

  return sawSwitchChange ? "switch" : "none";
}

/**
 * 回路のトポロジー・パラメータからシミュレーション結果(後退オイラー法)を計算し、
 * 「現在の再生位置から少し過去～少し未来」だけをスライド窓としてキャッシュしつつ、
 * タイムマネージャーUI・回路データエリアに配布するコンテキスト。
 *
 * 後退オイラー法は逐次計算(各ステップが直前の状態に依存)なので、過去のスナップショットを
 * 保持しなくても、直近のコンデンサ電圧・コイル電流(チェックポイント)さえ覚えておけば
 * 続きから計算を再開できる。再生中は、毎フレーム「経過時間ぶんだけ計算して末尾に足し、
 * 同じ量だけ先頭を切り捨てる」処理を1セットで行うことで、保持データの範囲(グラフの描画範囲)が
 * カクつかず滑らかに移動するようにしている。
 */
export function SimulationProvider({ children }: { children: ReactNode }) {
  const nodes = useNodes<CircuitElementNodeType>();
  const edges = useEdges();

  const [engine, setEngine] = useState<EngineState>(INITIAL_ENGINE_STATE);
  const [isPlaying, setIsPlaying] = useState(false);

  // 再生ループ(tick)は isPlaying が変わらない限り再生成したくないため、
  // 最新の nodes/edges はrefにミラーして読む(依存に入れるとnodes/edgesの変化のたびに
  // ループが再起動し、滑らかさが損なわれるため)。
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  // 窓の続きを計算するためのチェックポイント(直近のコンデンサ電圧・コイル電流)
  const checkpointRef = useRef<{ timeSec: number; state: SolverState } | null>(
    null,
  );
  // 経過時間をTIME_STEP_SEC単位に量子化するためのアキュムレータ(端数を次フレームへ繰り越す)
  const accumulatedSecRef = useRef(0);
  // 直前に確定させた(=デバウンス後の再計算を実際に行った時点の)nodes/edges。
  // classifyChangeで、今回の変更が「スイッチ操作だけ」かどうかを判定するための基準にする。
  const prevNodesRef = useRef<CircuitElementNodeType[] | null>(null);
  const prevEdgesRef = useRef<Edge[] | null>(null);

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
      const prevNodes = prevNodesRef.current;
      const prevEdges = prevEdgesRef.current;
      const changeKind: ChangeKind =
        prevNodes && prevEdges
          ? classifyChange(prevNodes, prevEdges, nodes, edges)
          : "topology";

      if (changeKind === "none") {
        prevNodesRef.current = nodes;
        prevEdgesRef.current = edges;
        return;
      }

      setEngine((prev) => {
        // スイッチだけが切り替わった場合: 時刻をリセットせず、現在時刻ちょうどの
        // コンデンサ電圧・コイル電流を既存スナップショットから復元し、
        // そこから新しい(切り替え後の)スイッチ状態で続きを計算し直す。
        if (changeKind === "switch") {
          const stepIndex = Math.round(
            (prev.currentTimeSec - prev.windowStartSec) / TIME_STEP_SEC,
          );
          const atNow =
            stepIndex >= 0 && stepIndex < prev.snapshots.length
              ? prev.snapshots[stepIndex]
              : undefined;
          if (atNow) {
            const seedState = solverStateFromSnapshot(nodes, atNow);
            const stepCount = Math.round(FUTURE_WINDOW_SEC / TIME_STEP_SEC) + 1;
            const result = runSimulation(
              nodes,
              edges,
              TIME_STEP_SEC,
              prev.currentTimeSec,
              stepCount,
              seedState,
            );
            if (result.ok) {
              accumulatedSecRef.current = 0;
              checkpointRef.current = {
                timeSec: prev.currentTimeSec + (stepCount - 1) * TIME_STEP_SEC,
                state: result.finalState,
              };
              const merged = [
                ...prev.snapshots.slice(0, stepIndex),
                ...result.snapshots,
              ];
              const trimmed = trimToWindow(
                merged,
                prev.windowStartSec,
                prev.currentTimeSec,
              );
              return {
                currentTimeSec: prev.currentTimeSec,
                windowStartSec: trimmed.windowStartSec,
                snapshots: trimmed.snapshots,
                errorReason: null,
              };
            }
            return { ...prev, errorReason: result.reason };
          }
          // 継続に使えるスナップショットが無ければ、下の「時刻0から作り直す」処理にフォールバックする
        }

        // トポロジー変更(素子の追加/削除・配線変更・スイッチ以外のparams変更)、初回マウント、
        // またはスイッチ継続に使えるスナップショットが無かった場合: 時刻0から作り直す
        accumulatedSecRef.current = 0;
        const result = computeFreshWindow(nodes, edges, 0);
        if (result.ok) {
          checkpointRef.current = {
            timeSec: (result.snapshots.length - 1) * TIME_STEP_SEC,
            state: result.finalState,
          };
          return {
            currentTimeSec: 0,
            windowStartSec: 0,
            snapshots: result.snapshots,
            errorReason: null,
          };
        }
        checkpointRef.current = null;
        return {
          currentTimeSec: 0,
          windowStartSec: 0,
          snapshots: [],
          errorReason: result.reason,
        };
      });

      prevNodesRef.current = nodes;
      prevEdgesRef.current = edges;
    }, RECOMPUTE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [circuitFingerprint]);

  // 再生中の1本のrAFループ。毎フレーム「経過時間ぶんだけ計算して末尾に足し、
  // 再生位置がPAST_WINDOW_SECより古くなった先頭分を切り捨てる」処理を1セットで行う。
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isPlaying) return;
    let last = performance.now();
    const tick = (now: number) => {
      const deltaSimSec = ((now - last) / 1000) * PLAYBACK_SPEED;
      last = now;
      accumulatedSecRef.current += deltaSimSec;
      const steps = Math.floor(accumulatedSecRef.current / TIME_STEP_SEC);

      if (steps > 0 && checkpointRef.current) {
        accumulatedSecRef.current -= steps * TIME_STEP_SEC;
        const checkpoint = checkpointRef.current;
        const result = runSimulation(
          nodesRef.current,
          edgesRef.current,
          TIME_STEP_SEC,
          checkpoint.timeSec + TIME_STEP_SEC,
          steps,
          checkpoint.state,
        );
        if (result.ok) {
          checkpointRef.current = {
            timeSec: checkpoint.timeSec + steps * TIME_STEP_SEC,
            state: result.finalState,
          };
          setEngine((prev) => {
            const newCurrentTimeSec =
              prev.currentTimeSec + steps * TIME_STEP_SEC;
            const extended = [...prev.snapshots, ...result.snapshots];
            const trimmed = trimToWindow(
              extended,
              prev.windowStartSec,
              newCurrentTimeSec,
            );
            return {
              currentTimeSec: newCurrentTimeSec,
              windowStartSec: trimmed.windowStartSec,
              snapshots: trimmed.snapshots,
              errorReason: null,
            };
          });
        } else {
          setEngine((prev) => ({ ...prev, errorReason: result.reason }));
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  // シークは明示的なユーザー操作なので、再生ループとは別に一括計算してよい。
  const seek = useCallback((targetTimeSec: number) => {
    const clampedTarget = Math.max(0, targetTimeSec);
    setEngine((prev) => {
      // 保持している窓より前へ戻る場合は、そこを新たな時刻0とみなして作り直す
      if (clampedTarget < prev.windowStartSec) {
        const result = computeFreshWindow(
          nodesRef.current,
          edgesRef.current,
          clampedTarget,
        );
        accumulatedSecRef.current = 0;
        if (result.ok) {
          checkpointRef.current = {
            timeSec: (result.snapshots.length - 1) * TIME_STEP_SEC,
            state: result.finalState,
          };
          const trimmed = trimToWindow(result.snapshots, 0, clampedTarget);
          return {
            currentTimeSec: clampedTarget,
            windowStartSec: trimmed.windowStartSec,
            snapshots: trimmed.snapshots,
            errorReason: null,
          };
        }
        checkpointRef.current = null;
        return {
          currentTimeSec: clampedTarget,
          windowStartSec: 0,
          snapshots: [],
          errorReason: result.reason,
        };
      }

      // シーク先からFUTURE_WINDOW_SECぶん先まで、既に計算済みかどうかを確認する。
      // 窓の範囲内へのシークでも、グラフの表示範囲(graphDomainSec)がcurrentTimeSecに
      // 追従できるよう、常にシーク位置を基準に窓を切り詰め直す(表示の即時性のため)。
      const cachedEndSec =
        prev.windowStartSec + prev.snapshots.length * TIME_STEP_SEC;
      const neededEndSec = clampedTarget + FUTURE_WINDOW_SEC;
      if (neededEndSec <= cachedEndSec) {
        const trimmed = trimToWindow(
          prev.snapshots,
          prev.windowStartSec,
          clampedTarget,
        );
        return {
          currentTimeSec: clampedTarget,
          windowStartSec: trimmed.windowStartSec,
          snapshots: trimmed.snapshots,
          errorReason: null,
        };
      }

      // 未計算の範囲が残っている場合は、その場でまとめて延長する
      if (!checkpointRef.current)
        return { ...prev, currentTimeSec: clampedTarget };
      const additionalStepCount = Math.round(
        (neededEndSec - cachedEndSec) / TIME_STEP_SEC,
      );
      const checkpoint = checkpointRef.current;
      const result = runSimulation(
        nodesRef.current,
        edgesRef.current,
        TIME_STEP_SEC,
        checkpoint.timeSec + TIME_STEP_SEC,
        additionalStepCount,
        checkpoint.state,
      );
      if (!result.ok) return { ...prev, errorReason: result.reason };
      checkpointRef.current = {
        timeSec: checkpoint.timeSec + additionalStepCount * TIME_STEP_SEC,
        state: result.finalState,
      };
      const trimmed = trimToWindow(
        [...prev.snapshots, ...result.snapshots],
        prev.windowStartSec,
        clampedTarget,
      );
      return {
        currentTimeSec: clampedTarget,
        windowStartSec: trimmed.windowStartSec,
        snapshots: trimmed.snapshots,
        errorReason: null,
      };
    });
  }, []);

  const currentSnapshot = useMemo(() => {
    if (engine.snapshots.length === 0) return null;
    const stepIndex = Math.min(
      engine.snapshots.length - 1,
      Math.max(
        0,
        Math.round(
          (engine.currentTimeSec - engine.windowStartSec) / TIME_STEP_SEC,
        ),
      ),
    );
    return engine.snapshots[stepIndex];
  }, [engine]);

  const value: SimulationContextValue = {
    currentSnapshot,
    snapshots: engine.snapshots,
    errorReason: engine.errorReason,
    currentTimeSec: engine.currentTimeSec,
    windowStartSec: engine.windowStartSec,
    cachedDurationSec:
      engine.windowStartSec + engine.snapshots.length * TIME_STEP_SEC,
    graphDomainSec: [
      Math.max(0, engine.currentTimeSec - PAST_WINDOW_SEC),
      engine.currentTimeSec + FUTURE_WINDOW_SEC,
    ],
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
