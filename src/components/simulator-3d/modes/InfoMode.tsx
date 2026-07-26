"use client";

import { Html } from "@react-three/drei";
import { CircuitFloor } from "../CircuitFloor";
import { formatElementLabel } from "../geometry";
import type { CircuitLayout } from "../use3DCircuitLayout";

const LABEL_HEIGHT = 0.3;

/**
 * 素子情報モード: 各素子の名前・主要パラメータをラベルとして浮かせて表示する。
 * シミュレーション結果に依存しない静的な情報のみなので、アニメーションはしない。
 */
export function InfoMode({ layout }: { layout: CircuitLayout }) {
  return (
    <CircuitFloor layout={layout}>
      {layout.elements.map((element) => (
        <Html
          key={element.id}
          position={[element.center.x, LABEL_HEIGHT, element.center.z]}
          center
          distanceFactor={8}
          className="pointer-events-none"
        >
          <div className="whitespace-nowrap rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-100">
            {formatElementLabel(element.node)}
          </div>
        </Html>
      ))}
    </CircuitFloor>
  );
}
