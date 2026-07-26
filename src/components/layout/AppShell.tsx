"use client";

import { CircuitMakerArea } from "@/components/circuit-maker/CircuitMakerArea";
import { DataArea } from "@/components/data-panel/DataArea";
import { SettingsArea } from "@/components/settings/SettingsArea";
import { Simulator3DArea } from "@/components/simulator-3d/Simulator3DArea";
import { TimeManagerArea } from "@/components/time-manager/TimeManagerArea";
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
      <AppHeader />

      {/* ヘッダーの下の残り領域全体を、左右2つのカラムに分割する */}
      <Group orientation="horizontal" className="min-h-0 flex-1">
        {/* 左カラム: 回路メーカーエリア（上）＋ 回路セッティングエリア（下） */}
        <Panel
          id="left-column"
          defaultSize="60"
          minSize="15"
          collapsible
          collapsedSize="0"
        >
          <Group orientation="vertical" className="h-full">
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

        {/* 右カラム: 3Dビュー（上）＋ タイムマネージャー（中）＋ データエリア（下） */}
        <Panel
          id="right-column"
          defaultSize="40"
          minSize="15"
          collapsible
          collapsedSize="0"
        >
          <Group orientation="vertical" className="h-full">
            <Panel
              id="simulator-3d-area"
              defaultSize="55"
              minSize="15"
              collapsible
              collapsedSize="0"
            >
              <Simulator3DArea />
            </Panel>

            <PanelSeparator parentGroupOrientation="vertical" />

            {/* タイムマネージャーUIは高さの意味が大きいので、ピクセル単位でサイズ指定している */}
            <Panel
              id="time-manager-area"
              defaultSize={56}
              minSize={40}
              maxSize={120}
              collapsible
              collapsedSize={0}
            >
              <TimeManagerArea />
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
    </div>
  );
}
