"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { SimulationSnapshot } from "@/lib/circuit-solver/types";
import { CircuitFloor } from "../CircuitFloor";
import { deriveWireCurrents } from "../deriveWireCurrents";
import { TubeSegment } from "../Segment";
import type { CircuitLayout } from "../use3DCircuitLayout";
import { getElementEndpoints } from "../use3DCircuitLayout";
import { useRunningMax } from "../useRunningMax";

const ACCENT_COLOR = "#f97316"; // orange-500。電位モードの壁と同じ色に揃えている
const MIN_RADIUS = 0.03;
const MAX_RADIUS = 0.2;
/** フラットな回路図(y=0)より少し浮かせて重ねる高さ */
const OVERLAY_HEIGHT = 0.1;
/** 管を半透明にして、中の向き矢印(DirectionArrow)が透けて見えるようにする */
const TUBE_OPACITY = 0.55;
/** これ未満の電流は「ほぼ0」とみなし、向きの矢印を出さない(向きが定義しづらいノイズを避ける) */
const ARROW_MIN_CURRENT = 1e-6;
const ARROW_LENGTH = 0.35;

function radiusFor(current: number, maxAbsCurrent: number): number {
  if (maxAbsCurrent < 1e-12) return MIN_RADIUS;
  const ratio = Math.sqrt(Math.min(1, Math.abs(current) / maxAbsCurrent));
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * ratio;
}

/** 電流の向きを示す、静的な矢印(円錐)。reversedならfrom→toと逆向きに立てる。 */
function DirectionArrow({
  from,
  to,
  reversed,
}: {
  from: [number, number, number];
  to: [number, number, number];
  reversed: boolean;
}) {
  const { position, quaternion } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const direction = new THREE.Vector3()
      .subVectors(reversed ? start : end, reversed ? end : start)
      .normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction,
    );
    return { position: mid, quaternion: quat };
  }, [from, to, reversed]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <coneGeometry args={[ARROW_LENGTH / 2, ARROW_LENGTH, 8]} />
      <meshStandardMaterial color={ACCENT_COLOR} />
    </mesh>
  );
}

/**
 * 電流モード: フラットな回路図(CircuitFloor)の上に、素子を流れる電流(既知)と
 * 配線を流れる電流(deriveWireCurrentsで都度導出)を、太さ(管の直径)で表現した管を
 * 少し浮かせて重ねる。向きは、大きさが十分ある素子にだけ静的な矢印で示す。
 * 太さの基準(maxAbsCurrent)は、瞬間値ではなく「これまで観測した最大値」を使うことで、
 * 交流回路でも表示が急に大きくなったり小さくなったりしないようにしている。
 */
export function CurrentMode({
  layout,
  snapshot,
}: {
  layout: CircuitLayout;
  snapshot: SimulationSnapshot | null;
}) {
  const wireCurrents = useMemo<Map<string, number>>(
    () => (snapshot ? deriveWireCurrents(layout, snapshot) : new Map()),
    [layout, snapshot],
  );

  const instantMaxAbsCurrent = useMemo(() => {
    if (!snapshot) return 0;
    let max = 0;
    for (const value of Object.values(snapshot.elementCurrents)) {
      max = Math.max(max, Math.abs(value));
    }
    for (const value of wireCurrents.values()) {
      max = Math.max(max, Math.abs(value));
    }
    return max;
  }, [snapshot, wireCurrents]);
  const maxAbsCurrent = useRunningMax(instantMaxAbsCurrent, layout);

  return (
    <CircuitFloor layout={layout}>
      {snapshot &&
        layout.wires.map((wire) => {
          const current = wireCurrents.get(wire.edgeId) ?? 0;
          return (
            <TubeSegment
              key={wire.edgeId}
              from={[wire.from.x, OVERLAY_HEIGHT, wire.from.z]}
              to={[wire.to.x, OVERLAY_HEIGHT, wire.to.z]}
              radius={radiusFor(current, maxAbsCurrent)}
              color={ACCENT_COLOR}
              opacity={TUBE_OPACITY}
            />
          );
        })}
      {snapshot &&
        layout.elements.map((element) => {
          const endpoints = getElementEndpoints(element);
          const current = snapshot.elementCurrents[element.id];
          if (!endpoints || current === undefined) return null;
          const from: [number, number, number] = [
            endpoints.a.x,
            OVERLAY_HEIGHT,
            endpoints.a.z,
          ];
          const to: [number, number, number] = [
            endpoints.b.x,
            OVERLAY_HEIGHT,
            endpoints.b.z,
          ];
          return (
            <group key={element.id}>
              <TubeSegment
                from={from}
                to={to}
                radius={radiusFor(current, maxAbsCurrent)}
                color={ACCENT_COLOR}
                opacity={TUBE_OPACITY}
              />
              {Math.abs(current) >= ARROW_MIN_CURRENT && (
                <DirectionArrow from={from} to={to} reversed={current < 0} />
              )}
            </group>
          );
        })}
    </CircuitFloor>
  );
}
