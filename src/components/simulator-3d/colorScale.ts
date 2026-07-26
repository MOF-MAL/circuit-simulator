/**
 * 電力(発熱)モード用の、値→色の変換。
 * 3Dシーンのマテリアル色と、凡例(Legend.tsx)のCSSグラデーションの両方から
 * 同じ色停止点を参照することで、見た目がズレないようにしている。
 */

/** 青→緑→黄→赤 の4色。低発熱→高発熱に対応する */
export const POWER_COLOR_STOPS = ["#3b82f6", "#22c55e", "#eab308", "#ef4444"];

/** 値が無い素子(アース・未接続のスイッチB・非理想電流計など)に使う中立色 */
export const NO_DATA_COLOR = "#94a3b8";

/** 相対正規化で表現する対数レンジの幅(桁数)。maxPowerを基準に、その6桁下まで青→赤で表現する。 */
const POWER_LOG_RANGE_DECADES = 6;

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const toHex = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** t(0〜1)を、複数の色停止点の間で線形補間する */
export function lerpColor(
  t: number,
  stops: string[] = POWER_COLOR_STOPS,
): string {
  const clamped = Math.max(0, Math.min(1, t));
  const segmentCount = stops.length - 1;
  const scaled = clamped * segmentCount;
  const index = Math.min(Math.floor(scaled), segmentCount - 1);
  const localT = scaled - index;

  const from = hexToRgb(stops[index]);
  const to = hexToRgb(stops[index + 1]);
  const mixed: [number, number, number] = [
    from[0] + (to[0] - from[0]) * localT,
    from[1] + (to[1] - from[1]) * localT,
    from[2] + (to[2] - from[2]) * localT,
  ];
  return rgbToHex(mixed);
}

/**
 * 消費電力(W)をヒートカラーに変換する。maxPowerは「これまで観測した最大値」
 * (useRunningMaxで求める)を渡す想定で、対数レンジ[maxPower/10^6, maxPower]を
 * 青→赤にマッピングする相対評価にする(電位・電流モードと同じ考え方に揃え、
 * 回路の実際のスケールに関わらず表示が大きくなりすぎ・小さくなりすぎないようにする)。
 * powerがnull(値が定義できない素子)、またはmaxPowerがまだ0(観測前)の場合はNO_DATA_COLORを返す。
 */
export function powerToColor(power: number | null, maxPower: number): string {
  if (power === null || !Number.isFinite(power) || maxPower <= 0)
    return NO_DATA_COLOR;
  const logMax = Math.log10(maxPower);
  const logP = Math.log10(Math.max(power, maxPower * 1e-9));
  const t =
    (logP - (logMax - POWER_LOG_RANGE_DECADES)) / POWER_LOG_RANGE_DECADES;
  return lerpColor(t);
}

/** Legend.tsxのCSSグラデーションと共有するための、色停止点をCSS linear-gradient文字列にしたもの */
export function powerGradientCss(): string {
  return `linear-gradient(to right, ${POWER_COLOR_STOPS.join(", ")})`;
}
