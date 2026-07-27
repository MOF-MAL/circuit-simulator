"use client";

import type { SimulationSnapshot } from "@/lib/circuit-solver/types";
import { CircuitFloor } from "../CircuitFloor";
import { powerToColor } from "../colorScale";
import { TubeSegment } from "../Segment";
import type { CircuitLayout } from "../use3DCircuitLayout";
import { getElementEndpoints } from "../use3DCircuitLayout";
import { useRunningMax } from "../useRunningMax";

/** フラットな回路図(y=0)より少し浮かせて重ねる高さ */
const OVERLAY_HEIGHT = 0.1;
const OVERLAY_RADIUS = 0.14;
/** 管を半透明にして、下のフラットな回路記号が透けて見えるようにする(電流モードと同じ値) */
const TUBE_OPACITY = 0.55;

function elementPower(
  snapshot: SimulationSnapshot,
  elementId: string,
): number | null {
  const v = snapshot.elementVoltages[elementId];
  const i = snapshot.elementCurrents[elementId];
  return v !== undefined && i !== undefined ? Math.abs(v * i) : null;
}

/**
 * 電力(発熱)モード: フラットな回路図(CircuitFloor)の上に、消費電力
 * P = |V×I| をヒートカラーで着色した半透明の管を少し浮かせて重ねる。
 * 電力を消費する(発熱する)素子は抵抗だけなので、抵抗以外(電源・コンデンサ・コイル・
 * スイッチ・計器など)には何も重ねない(=回路図の線のまま)。
 * 色の基準(maxPower)は、瞬間値ではなく「これまで観測した最大値」を使うことで、
 * 交流回路でも表示が急に大きくなったり小さくなったりしないようにしている。
 */
export function PowerMode({
  layout,
  snapshot,
}: {
  layout: CircuitLayout;
  snapshot: SimulationSnapshot | null;
}) {
  const resistors = layout.elements.filter(
    (element) => element.node.data.elementType === "resistor" && element.active,
  );

  const instantMaxPower = snapshot
    ? Math.max(
        0,
        ...resistors
          .map((element) => elementPower(snapshot, element.id))
          .filter((power): power is number => power !== null),
      )
    : 0;
  const maxPower = useRunningMax(instantMaxPower, layout);

  return (
    <CircuitFloor layout={layout}>
      {snapshot &&
        resistors.map((element) => {
          const endpoints = getElementEndpoints(element);
          const power = elementPower(snapshot, element.id);
          if (!endpoints || power === null) return null;
          return (
            <TubeSegment
              key={element.id}
              from={[endpoints.a.x, OVERLAY_HEIGHT, endpoints.a.z]}
              to={[endpoints.b.x, OVERLAY_HEIGHT, endpoints.b.z]}
              radius={OVERLAY_RADIUS}
              color={powerToColor(power, maxPower)}
              opacity={TUBE_OPACITY}
            />
          );
        })}
    </CircuitFloor>
  );
}
