/**
 * 回路素子の「種類」を表すメタデータ（JSXを含まない純粋なデータ定義）。
 *
 * ツールボックス（一覧表示）と、React Flow のカスタムノード（キャンバス表示）の
 * 両方から、この同じ配列・型を参照する。
 * こうしておくことで「素子の種類を増やす」ときに直すべき場所が1箇所で済む。
 */
export const CIRCUIT_ELEMENT_TYPES = [
  { id: "resistor", label: "抵抗", terminalCount: 2, maxCount: undefined },
  {
    id: "capacitor",
    label: "コンデンサ",
    terminalCount: 2,
    maxCount: undefined,
  },
  { id: "inductor", label: "コイル", terminalCount: 2, maxCount: undefined },
  { id: "dc-source", label: "直流電源", terminalCount: 2, maxCount: undefined },
  { id: "ac-source", label: "交流電源", terminalCount: 2, maxCount: undefined },
  { id: "switch-a", label: "スイッチA", terminalCount: 2, maxCount: undefined },
  // スイッチB: 共通端子1つ＋任意個の端子から1つを選んで接続する切替スイッチ。
  // 実際の端子数はノードごとに params.terminalCount で変えられる（ここは初期値の目安）。
  { id: "switch-b", label: "スイッチB", terminalCount: 3, maxCount: undefined },
  { id: "ammeter", label: "電流計", terminalCount: 2, maxCount: undefined },
  { id: "voltmeter", label: "電圧計", terminalCount: 2, maxCount: undefined },
  // 節点: 端子1つのみの合流・分流点。複数のワイヤーを同じ端子に接続できるため、
  // 回路の形を整えたり配線をまとめたりする用途に使う(個数制限なし)。
  { id: "junction", label: "節点", terminalCount: 1, maxCount: undefined },
  // アースは電位の基準となる1点のみが意味を持つため、maxCountで複数配置を禁止する
  { id: "ground", label: "アース", terminalCount: 1, maxCount: 1 },
] as const;

/** 回路素子の種類を表す文字列リテラル型（"resistor" | "capacitor" | ... ） */
export type CircuitElementType = (typeof CIRCUIT_ELEMENT_TYPES)[number]["id"];

/** 回路セッティングエリアで編集する、1つのパラメータの定義 */
export type ElementParamDef =
  | {
      key: string;
      label: string;
      unit: string;
      kind: "number";
      defaultValue: number;
    }
  | { key: string; label: string; kind: "boolean"; defaultValue: boolean }
  // 「未接続」「端子1に接続」...のように、他のパラメータ(端子数)に応じて
  // 選択肢が変わるプルダウン。値は 0=未接続、1..N=端子番号。
  | {
      key: string;
      label: string;
      kind: "terminal-select";
      defaultValue: number;
    };

/** 素子の種類ごとに、編集できるパラメータの一覧を定義する */
export const ELEMENT_PARAM_DEFS: Record<CircuitElementType, ElementParamDef[]> =
  {
    resistor: [
      {
        key: "resistance",
        label: "抵抗値",
        unit: "Ω",
        kind: "number",
        defaultValue: 100,
      },
    ],
    capacitor: [
      {
        key: "capacitance",
        label: "静電容量",
        unit: "F",
        kind: "number",
        defaultValue: 0.000001,
      },
      {
        key: "initialCharge",
        label: "初期電荷",
        unit: "C",
        kind: "number",
        defaultValue: 0,
      },
    ],
    inductor: [
      {
        key: "inductance",
        label: "インダクタンス",
        unit: "H",
        kind: "number",
        defaultValue: 0.001,
      },
    ],
    "dc-source": [
      {
        key: "voltage",
        label: "電圧",
        unit: "V",
        kind: "number",
        defaultValue: 5,
      },
    ],
    "ac-source": [
      {
        key: "amplitude",
        label: "振幅",
        unit: "V",
        kind: "number",
        defaultValue: 5,
      },
      {
        key: "frequency",
        label: "周波数",
        unit: "Hz",
        kind: "number",
        defaultValue: 50,
      },
    ],
    "switch-a": [
      {
        key: "closed",
        label: "スイッチが閉じている(ON)",
        kind: "boolean",
        defaultValue: false,
      },
    ],
    "switch-b": [
      {
        key: "terminalCount",
        label: "端子数",
        unit: "",
        kind: "number",
        defaultValue: 3,
      },
      {
        key: "connectedTerminal",
        label: "接続先",
        kind: "terminal-select",
        defaultValue: 0,
      },
    ],
    // 理想的な電流計の内部抵抗は0Ω(電流の妨げにならない)
    ammeter: [
      {
        key: "internalResistance",
        label: "内部抵抗",
        unit: "Ω",
        kind: "number",
        defaultValue: 0,
      },
    ],
    // 理想的な電圧計の内部抵抗は無限大だが、数値入力欄のため
    // 実用上ほぼ理想とみなせる大きな値(1MΩ)を既定値にしている
    voltmeter: [
      {
        key: "internalResistance",
        label: "内部抵抗",
        unit: "Ω",
        kind: "number",
        defaultValue: 1000000,
      },
    ],
    ground: [],
    junction: [],
  };

/** 素子の種類ID(例: "resistor")から、日本語ラベル(例: "抵抗")を逆引きする */
export function elementTypeLabel(elementType: CircuitElementType): string {
  const found = CIRCUIT_ELEMENT_TYPES.find((type) => type.id === elementType);
  return found ? found.label : elementType;
}

/** ノードを新規作成するときに使う、素子の種類ごとの初期パラメータ値を作る */
export function createDefaultParams(
  elementType: CircuitElementType,
): Record<string, number | boolean> {
  const params: Record<string, number | boolean> = {};
  for (const def of ELEMENT_PARAM_DEFS[elementType]) {
    params[def.key] = def.defaultValue;
  }
  return params;
}
