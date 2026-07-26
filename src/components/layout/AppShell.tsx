"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { CircuitMakerArea } from "@/components/circuit-maker/CircuitMakerArea";
import { DataArea } from "@/components/data-panel/DataArea";
import { SettingsArea } from "@/components/settings/SettingsArea";
import { SimulationProvider } from "@/components/simulation/SimulationProvider";
import { Simulator3DArea } from "@/components/simulator-3d/Simulator3DArea";
import { AppHeader } from "./AppHeader";
import { PanelSeparator } from "./PanelSeparator";
import { Group, Panel } from "./resizable-panels";

/**
 * アプリ全体のレイアウトを組み立てるコンポーネント。
 *
 * 画面構成（手書きレイアウトを再現）:
 *
 * ┌─────────────────────────────────────────────┐
 * │ メニューバー（常に表示・リサイズ対象外）         │
 * ├───────────────────────┬───────────────────────┤
 * │ 回路メーカーエリア      │ 3Dビューエリア          │
 * │（ツールボックス＋キャンバス）│                  │
 * │                       ├───────────────────────┤
 * │                       │ タイムマネージャーUI     │
 * ├───────────────────────┼───────────────────────┤
 * │ 回路セッティングエリア   │ 回路データエリア         │
 * └───────────────────────┴───────────────────────┘
 *
 * すべての境界線はドラッグでリサイズでき、画面端までドラッグすると
 * そのエリアが折りたたまれる（react-resizable-panels の
 * collapsible / collapsedSize によって実現している）。
 */
export function AppShell() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/*
        ReactFlowProvider をヘッダーごとルート全体に被せることで、
        メニューバー(AppHeader、回路のセーブ・ロード)・回路メーカーエリア(CircuitCanvas)・
        回路セッティングエリア(SettingsArea)・回路データエリア(DataArea)が同じ React Flow の
        ストアを共有できる。ReactFlowProvider 自体はDOM要素を持たないので、
        Group/Panelのレイアウトには影響しない。
      */}
      <ReactFlowProvider>
        {/*
          SimulationProvider: 回路のシミュレーション結果(電圧・電流)を計算・キャッシュし、
          タイムマネージャーUIと回路データエリアの両方に配布する。ReactFlowのノード/エッジを
          読む必要があるため、ReactFlowProviderの内側に置く。
        */}
        <SimulationProvider>
          <AppHeader />

          {/* ヘッダーの下の残り領域全体を、左右2つのカラムに分割する */}
          <Group
            id="root-columns"
            orientation="horizontal"
            className="min-h-0 flex-1"
          >
            {/* 左カラム: 回路メーカーエリア（上）＋ 回路セッティングエリア（下） */}
            <Panel
              id="left-column"
              defaultSize="60"
              minSize="15"
              collapsible
              collapsedSize="0"
            >
              <Group
                id="left-column-rows"
                orientation="vertical"
                className="h-full"
              >
                <Panel
                  id="circuit-maker-area"
                  defaultSize="65"
                  minSize="15"
                  collapsible
                  collapsedSize="0"
                >
                  <CircuitMakerArea />
                </Panel>

                <PanelSeparator parentGroupOrientation="vertical" />

                <Panel
                  id="settings-area"
                  defaultSize="35"
                  minSize="10"
                  collapsible
                  collapsedSize="0"
                >
                  <SettingsArea />
                </Panel>
              </Group>
            </Panel>

            <PanelSeparator parentGroupOrientation="horizontal" />

            {/* 右カラム: 3Dビュー（タイムマネージャーUIを内包）＋ データエリア（下） */}
            <Panel
              id="right-column"
              defaultSize="40"
              minSize="15"
              collapsible
              collapsedSize="0"
            >
              <Group
                id="right-column-rows"
                orientation="vertical"
                className="h-full"
              >
                {/*
                タイムマネージャーUIは独立したリサイズ領域にはせず、
                Simulator3DArea の内部下部に固定表示する（3Dビューの一部という扱い）。
              */}
                <Panel
                  id="simulator-3d-area"
                  defaultSize="65"
                  minSize="20"
                  collapsible
                  collapsedSize="0"
                >
                  <Simulator3DArea />
                </Panel>

                <PanelSeparator parentGroupOrientation="vertical" />

                <Panel
                  id="data-area"
                  defaultSize="35"
                  minSize="10"
                  collapsible
                  collapsedSize="0"
                >
                  <DataArea />
                </Panel>
              </Group>
            </Panel>
          </Group>
        </SimulationProvider>
      </ReactFlowProvider>
    </div>
  );
}
