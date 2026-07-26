"use client";

import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import type { DisplayMode } from "./Legend";
import { CurrentMode } from "./modes/CurrentMode";
import { InfoMode } from "./modes/InfoMode";
import { PotentialMode } from "./modes/PotentialMode";
import { PowerMode } from "./modes/PowerMode";
import { use3DCircuitLayout } from "./use3DCircuitLayout";

const GRID_SIZE = 20;
const GRID_DIVISIONS = 20;

/**
 * 3Dシーン本体(Canvasの中身)。カメラ・ライト・グリッド床・OrbitControlsを用意し、
 * 選択中のモードに応じた表示コンポーネントを1つだけ描画する。
 * 回路のレイアウト(use3DCircuitLayout)とシミュレーション結果(useSimulation)は
 * ここで一度だけ取得し、各モードコンポーネントへpropsとして渡す。
 */
export function Scene3D({ mode }: { mode: DisplayMode }) {
  const layout = use3DCircuitLayout();
  const { currentSnapshot } = useSimulation();

  // 回路がキャンバスのどこにあっても画面に収まるよう、素子・配線の重心を
  // カメラの注視点にする(回路メーカー側のレイアウトが原点から離れていることが多いため)。
  // 半径(回路の広がり)も求め、初期カメラの高さをそれに合わせて調整する。
  const { center, radius } = useMemo(() => {
    const points = [
      ...layout.elements.map((element) => element.center),
      ...layout.wires.flatMap((wire) => [wire.from, wire.to]),
    ];
    if (points.length === 0) return { center: { x: 0, z: 0 }, radius: 4 };
    const sum = points.reduce(
      (acc, p) => ({ x: acc.x + p.x, z: acc.z + p.z }),
      { x: 0, z: 0 },
    );
    const c = { x: sum.x / points.length, z: sum.z / points.length };
    const maxDist = Math.max(
      ...points.map((p) => Math.hypot(p.x - c.x, p.z - c.z)),
    );
    return { center: c, radius: Math.max(4, maxDist * 1.8) };
  }, [layout]);

  return (
    <>
      {/*
        初期状態は、回路の斜め手前上方から見下ろす視点にする。upはThree.js標準の[0,1,0]のまま
        (以前[0,0,-1]にしていたが、OrbitControlsは`up`を軌道の極軸として扱うため、
        視覚的に「上」であるY軸と極軸がズレて視点操作の感覚がおかしくなっていた)。
      */}
      <PerspectiveCamera
        makeDefault
        position={[center.x, radius * 0.85, center.z + radius * 0.85]}
        fov={50}
      />
      <OrbitControls makeDefault target={[center.x, 0, center.z]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 3]} intensity={0.8} />
      <gridHelper
        args={[GRID_SIZE, GRID_DIVISIONS, "#d1d5db", "#e5e7eb"]}
        position={[center.x, 0, center.z]}
      />

      {/* 素子アイコンのテクスチャ読み込み(useTexture)がサスペンドするための境界 */}
      <Suspense fallback={null}>
        {mode === "potential" && (
          <PotentialMode layout={layout} snapshot={currentSnapshot} />
        )}
        {mode === "current" && (
          <CurrentMode layout={layout} snapshot={currentSnapshot} />
        )}
        {mode === "power" && (
          <PowerMode layout={layout} snapshot={currentSnapshot} />
        )}
        {mode === "info" && <InfoMode layout={layout} />}
      </Suspense>
    </>
  );
}
