"use client";

import { PanelSeparator } from "@/components/layout/PanelSeparator";
import { Group, Panel } from "@/components/layout/resizable-panels";
import { CircuitCanvas } from "./CircuitCanvas";
import { Toolbox } from "./Toolbox";

/**
 * 「回路メーカーエリア」全体。
 * 左側の「ツールボックス」と、右側の「キャンバス」を、
 * 横方向にリサイズ可能な Group で並べている。
 */
export function CircuitMakerArea() {
  return (
    <div className="flex h-full w-full flex-col">
      <p className="shrink-0 border-b border-slate-300 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        回路メーカーエリア
      </p>
      <Group
        id="circuit-maker-columns"
        orientation="horizontal"
        className="min-h-0 flex-1"
      >
        {/* ツールボックス: 幅はピクセル指定で、狭くしすぎるとたたまれる */}
        <Panel
          id="toolbox"
          defaultSize={72}
          minSize={56}
          maxSize={160}
          collapsible
          collapsedSize={0}
        >
          <Toolbox />
        </Panel>

        <PanelSeparator parentGroupOrientation="horizontal" />

        {/* キャンバス: 残りの幅いっぱいに広がる */}
        <Panel id="circuit-canvas" minSize="30">
          <CircuitCanvas />
        </Panel>
      </Group>
    </div>
  );
}
