"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Vec3 } from "./Segment";

/** 区間の長さだけで決まる、粒子どうしの間隔(ワールド単位)。電流の大きさには依存しない。 */
const PARTICLE_SPACING = 0.3;
/** 極端に長い配線でも描画コストが跳ね上がらないようにする上限 */
const MAX_PARTICLES = 24;
const PARTICLE_RADIUS = 0.045;
const PARTICLE_COLOR = "#ef4444"; // red-500
/** 電流が(これまでの観測最大値に対して)最大のときの、粒子の移動速度(ワールド単位/秒) */
const MAX_SPEED = 1.2;
/** これ未満の電流比率はノイズとみなし、粒子を完全に静止させる */
const MIN_CURRENT_RATIO = 1e-4;

/**
 * 電流モード用: 1本の区間(配線・素子)に沿って、一定間隔で並んだ赤い粒子を
 * 電流の大きさに応じた速さで流す(向きは電流の符号に従う)。粒子の「数・間隔」は
 * 区間の長さだけで決まり電流には依存しないため、電流が変わっても粒子数は変わらず、
 * 速さだけが変わる(このリポジトリで初めてuseFrame+instancedMeshを使う箇所)。
 */
export function ParticleStream({
  from,
  to,
  current,
  maxAbsCurrent,
}: {
  from: Vec3;
  to: Vec3;
  current: number;
  maxAbsCurrent: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const phaseRef = useRef(0);
  const dummyRef = useRef(new THREE.Object3D());

  const { start, end, length } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    return { start, end, length: start.distanceTo(end) };
  }, [from, to]);

  const count = useMemo(
    () =>
      Math.min(
        MAX_PARTICLES,
        Math.max(1, Math.round(length / PARTICLE_SPACING)),
      ),
    [length],
  );

  const ratio =
    maxAbsCurrent < 1e-12 ? 0 : Math.abs(current) / maxAbsCurrent;
  const speed =
    ratio < MIN_CURRENT_RATIO ? 0 : MAX_SPEED * Math.sqrt(Math.min(1, ratio));
  const reversed = current < 0;

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh || length < 1e-6) return;
    if (speed > 0) {
      phaseRef.current = (phaseRef.current + (delta * speed) / length) % 1;
    }
    const dummy = dummyRef.current;
    for (let i = 0; i < count; i++) {
      const t = (phaseRef.current + i / count) % 1;
      const tt = reversed ? 1 - t : t;
      dummy.position.lerpVectors(start, end, tt);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (length < 1e-6) return null;

  return (
    // countが変わったら(区間の長さが変わったら)容量を作り直すためkeyに使う
    <instancedMesh
      key={count}
      ref={meshRef}
      args={[undefined, undefined, count]}
    >
      <sphereGeometry args={[PARTICLE_RADIUS, 8, 8]} />
      <meshStandardMaterial color={PARTICLE_COLOR} />
    </instancedMesh>
  );
}
