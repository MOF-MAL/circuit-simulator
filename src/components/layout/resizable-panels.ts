/**
 * react-resizable-panels の再エクスポート用ラッパー。
 *
 * このプロジェクトが使っている react-resizable-panels は v4 系で、
 * 古いバージョン（PanelGroup / Panel / PanelResizeHandle という名前）とは
 * コンポーネント名や API が異なる（Group / Panel / Separator という名前になっている）。
 *
 * また、Next.js の Turbopack 環境ではライブラリの named export の解決に
 * 失敗してビルドエラーになることがあるため、いったん `import * as` で
 * モジュール全体を読み込んでから、必要な部品だけを再エクスポートしている。
 * 他のコンポーネントは "react-resizable-panels" を直接 import せず、
 * 必ずこのファイル経由で import すること。
 */
import * as ResizablePanels from "react-resizable-panels";

/** 複数の Panel をまとめて、リサイズ可能なレイアウトを作るための入れ物 */
export const Group = ResizablePanels.Group;

/** リサイズ・折りたたみ可能な1つの領域 */
export const Panel = ResizablePanels.Panel;

/** Panel と Panel の間にある、ドラッグ操作用の境界線 */
export const Separator = ResizablePanels.Separator;

// 型情報は実行時の値を持たないため、こちらは通常通り named import で問題ない
export type {
  GroupImperativeHandle,
  PanelImperativeHandle,
} from "react-resizable-panels";
