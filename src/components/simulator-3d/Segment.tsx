"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { segmentTransform } from "./geometry";

export type Vec3 = [number, number, number];

/**
 * 2点を結ぶ、帯状(箱型)のジオメトリ。配線・素子本体(共通フロア)や、
 * 電位モードの帯(高さを持たせる場合はfrom/toのyを変えるだけで坂になる)に使う。
 */
export function BoxSegment({
  from,
  to,
  width,
  height,
  color,
}: {
  from: Vec3;
  to: Vec3;
  width: number;
  height: number;
  color: string;
}) {
  const { position, quaternion, length } = useMemo(
    () =>
      segmentTransform(new THREE.Vector3(...from), new THREE.Vector3(...to)),
    [from, to],
  );
  if (length < 1e-6) return null;
  return (
    <mesh position={position} quaternion={quaternion}>
      <boxGeometry args={[length, height, width]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/**
 * 2点を結ぶ、円柱(管/チューブ)状のジオメトリ。電流モードで「配線を管にして太さで表現する」ために使う。
 */
export function TubeSegment({
  from,
  to,
  radius,
  color,
  opacity = 1,
}: {
  from: Vec3;
  to: Vec3;
  radius: number;
  color: string;
  /** 1未満にすると半透明になる(例: 電流モードで管の中の矢印を透かして見せるため) */
  opacity?: number;
}) {
  const { position, quaternion, length } = useMemo(
    () =>
      segmentTransform(
        new THREE.Vector3(...from),
        new THREE.Vector3(...to),
        new THREE.Vector3(0, 1, 0),
      ),
    [from, to],
  );
  if (length < 1e-6) return null;
  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}
