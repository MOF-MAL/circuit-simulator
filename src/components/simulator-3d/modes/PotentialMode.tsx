"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { SimulationSnapshot } from "@/lib/circuit-solver/types";
import { CircuitFloor } from "../CircuitFloor";
import { TubeSegment } from "../Segment";
import type { CircuitLayout } from "../use3DCircuitLayout";
import { getElementEndpoints } from "../use3DCircuitLayout";
import { useRunningMax } from "../useRunningMax";

/** 電位の高さの正規化先(3Dワールド単位)。実際の電位[V]ではなく、これまで観測した最大値を基準にした相対値。 */
export const POTENTIAL_TARGET_MAX_HEIGHT = 3;

const WALL_COLOR = "#f97316"; // orange-500
const WALL_OPACITY = 0.5;
const EDGE_COLOR = "#fed7aa"; // orange-200。角を強調する鉛直線の色(壁本体より薄く、控えめに)
const EDGE_RADIUS = 0.006;

/** スナップショット内の最大絶対電位を求める(0Vのみの場合は0を返す) */
export function computeMaxAbsVoltage(snapshot: SimulationSnapshot): number {
  let max = 0;
  for (const voltage of Object.values(snapshot.nodeVoltages)) {
    max = Math.max(max, Math.abs(voltage));
  }
  return max;
}

function potentialToHeight(
  netId: string,
  nodeVoltages: Record<string, number>,
  maxAbsVoltage: number,
): number {
  if (maxAbsVoltage < 1e-9) return 0;
  const voltage = nodeVoltages[netId] ?? 0;
  return (voltage / maxAbsVoltage) * POTENTIAL_TARGET_MAX_HEIGHT;
}

type WallSegment = {
  key: string;
  from: { x: number; z: number };
  to: { x: number; z: number };
  fromHeight: number;
  toHeight: number;
};

/**
 * 床(y=0、回路の位置)から、その地点の電位の高さまで鉛直に伸びる、半透明の壁。
 * 配線(区間の両端が同じ電位)なら長方形、素子(a端子・b端子で電位が異なる)なら
 * 天井の高さが両端で違う台形になる(4頂点は常に同一平面上に乗るので歪まない)。
 */
function PotentialWall({
  from,
  to,
  fromHeight,
  toHeight,
}: {
  from: { x: number; z: number };
  to: { x: number; z: number };
  fromHeight: number;
  toHeight: number;
}) {
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array([
      from.x,
      0,
      from.z,
      from.x,
      fromHeight,
      from.z,
      to.x,
      toHeight,
      to.z,
      to.x,
      0,
      to.z,
    ]);
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setIndex([0, 1, 2, 0, 2, 3]);
    return geom;
  }, [from.x, from.z, to.x, to.z, fromHeight, toHeight]);

  // 両端とも電位0(アース水準)なら壁は高さ0に潰れるので描画しない
  if (Math.abs(fromHeight) < 1e-6 && Math.abs(toHeight) < 1e-6) return null;

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        color={WALL_COLOR}
        transparent
        opacity={WALL_OPACITY}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/** 壁が曲がる角(=各端子の位置)に、立体感を強調するための細い鉛直線を1本立てる */
function CornerEdge({
  x,
  z,
  height,
}: {
  x: number;
  z: number;
  height: number;
}) {
  if (Math.abs(height) < 1e-6) return null;
  return (
    <TubeSegment
      from={[x, 0, z]}
      to={[x, height, z]}
      radius={EDGE_RADIUS}
      color={EDGE_COLOR}
    />
  );
}

/**
 * 電位モード: 配線・素子本体は厚みのないフラットな回路図のまま(CircuitFloor)、
 * その上に「電位の高さまで鉛直に伸びる半透明の壁」を別レイヤーとして重ねる。
 * ネット単位で1つの高さを持ち、素子をまたぐ区間(a端子とb端子で電位が異なる場合)は
 * 天井が斜めになった壁になる。壁が曲がる角(端子の位置)には鉛直線を立てて立体感を強調する。
 */
export function PotentialMode({
  layout,
  snapshot,
}: {
  layout: CircuitLayout;
  snapshot: SimulationSnapshot | null;
}) {
  const nodeVoltages = snapshot?.nodeVoltages ?? { ground: 0 };
  const instantMaxAbsVoltage = snapshot ? computeMaxAbsVoltage(snapshot) : 0;
  // 瞬間値だけを基準にすると、交流回路で電圧がゼロ点付近を通るたびに基準が縮んでチラつくため、
  // これまで観測した最大値を基準にする(回路が変わったらlayoutの参照が変わりリセットされる)。
  const maxAbsVoltage = useRunningMax(instantMaxAbsVoltage, layout);
  const heightOf = (netId: string) =>
    potentialToHeight(netId, nodeVoltages, maxAbsVoltage);

  const wallSegments: WallSegment[] = [];
  for (const wire of layout.wires) {
    const h = heightOf(wire.netId);
    wallSegments.push({
      key: wire.edgeId,
      from: wire.from,
      to: wire.to,
      fromHeight: h,
      toHeight: h,
    });
  }
  for (const element of layout.elements) {
    if (!element.active) continue; // 配線されていない・スイッチオフなど「オンでない」素子
    const endpoints = getElementEndpoints(element);
    if (!endpoints) continue; // アース、または未接続のスイッチB(回路的に開いている)
    wallSegments.push({
      key: element.id,
      from: endpoints.a,
      to: endpoints.b,
      fromHeight: heightOf(endpoints.a.netId),
      toHeight: heightOf(endpoints.b.netId),
    });
  }

  // 角(端子の位置)ごとに鉛直線を1本だけ立てるため、同じ位置の端点をまとめる
  const corners = new Map<string, { x: number; z: number; height: number }>();
  for (const segment of wallSegments) {
    const fromKey = `${segment.from.x.toFixed(4)},${segment.from.z.toFixed(4)}`;
    corners.set(fromKey, {
      x: segment.from.x,
      z: segment.from.z,
      height: segment.fromHeight,
    });
    const toKey = `${segment.to.x.toFixed(4)},${segment.to.z.toFixed(4)}`;
    corners.set(toKey, {
      x: segment.to.x,
      z: segment.to.z,
      height: segment.toHeight,
    });
  }

  return (
    <CircuitFloor layout={layout}>
      {wallSegments.map((segment) => (
        <PotentialWall
          key={segment.key}
          from={segment.from}
          to={segment.to}
          fromHeight={segment.fromHeight}
          toHeight={segment.toHeight}
        />
      ))}
      {Array.from(corners.entries()).map(([key, corner]) => (
        <CornerEdge
          key={key}
          x={corner.x}
          z={corner.z}
          height={corner.height}
        />
      ))}
    </CircuitFloor>
  );
}
