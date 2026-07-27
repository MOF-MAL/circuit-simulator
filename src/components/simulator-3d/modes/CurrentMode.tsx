"use client";

import { useMemo } from "react";
import type { SimulationSnapshot } from "@/lib/circuit-solver/types";
import { CircuitFloor } from "../CircuitFloor";
import { deriveWireCurrents } from "../deriveWireCurrents";
import { ParticleStream } from "../ParticleStream";
import { TubeSegment } from "../Segment";
import type { CircuitLayout } from "../use3DCircuitLayout";
import { getElementEndpoints } from "../use3DCircuitLayout";
import { useRunningMax } from "../useRunningMax";

/** 配線・素子の経路を示す、電流の大きさに関わらず常に表示する細いガイド線 */
const GUIDE_RADIUS = 0.02;
const GUIDE_COLOR = "#94a3b8"; // slate-400
const GUIDE_OPACITY = 0.35;
/** フラットな回路図(y=0)より少し浮かせて重ねる高さ */
const OVERLAY_HEIGHT = 0.1;

/**
 * 電流モード: フラットな回路図(CircuitFloor)の上に、素子を流れる電流(既知)と
 * 配線を流れる電流(deriveWireCurrentsで都度導出)を重ねて表示する。
 * 配線・素子の経路自体は、電流の大きさに関わらず常に細いガイド線として表示し、
 * その上を赤い粒子(ParticleStream)が電流の大きさに応じた速さで流れることで
 * 電流を表現する(粒子の間隔は区間の長さだけで決まり、電流には依存しない)。
 * 速さの基準(maxAbsCurrent)は、瞬間値ではなく「これまで観測した最大値」を使うことで、
 * 交流回路でも表示が急に速くなったり遅くなったりしないようにしている。
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
      {layout.wires.map((wire) => {
        const from: [number, number, number] = [
          wire.from.x,
          OVERLAY_HEIGHT,
          wire.from.z,
        ];
        const to: [number, number, number] = [
          wire.to.x,
          OVERLAY_HEIGHT,
          wire.to.z,
        ];
        const current = snapshot ? (wireCurrents.get(wire.edgeId) ?? 0) : undefined;
        return (
          <group key={wire.edgeId}>
            <TubeSegment
              from={from}
              to={to}
              radius={GUIDE_RADIUS}
              color={GUIDE_COLOR}
              opacity={GUIDE_OPACITY}
            />
            {current !== undefined && (
              <ParticleStream
                from={from}
                to={to}
                current={current}
                maxAbsCurrent={maxAbsCurrent}
              />
            )}
          </group>
        );
      })}
      {layout.elements.map((element) => {
        if (!element.active) return null; // 配線されていない・スイッチオフなど「オンでない」素子
        const endpoints = getElementEndpoints(element);
        if (!endpoints) return null;
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
        const current = snapshot
          ? (snapshot.elementCurrents[element.id] ?? 0)
          : undefined;
        return (
          <group key={element.id}>
            <TubeSegment
              from={from}
              to={to}
              radius={GUIDE_RADIUS}
              color={GUIDE_COLOR}
              opacity={GUIDE_OPACITY}
            />
            {current !== undefined && (
              <ParticleStream
                from={from}
                to={to}
                current={current}
                maxAbsCurrent={maxAbsCurrent}
              />
            )}
          </group>
        );
      })}
    </CircuitFloor>
  );
}
