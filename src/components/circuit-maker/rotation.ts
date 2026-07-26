import { Position } from "@xyflow/react";

/**
 * 回路素子の「向き」を表す共通の型・ユーティリティ。
 *
 * CircuitElementNode（Handleの位置を決める側）と、
 * SettingsArea（回転ボタン・回転角の表示をする側）の両方から参照する。
 */

/** 回路素子の回転角。90度刻みの4パターンのみを許可する。 */
export const ROTATIONS = [0, 90, 180, 270] as const;
export type Rotation = (typeof ROTATIONS)[number];

/** 「↻ 90度回転」ボタンを押したときに、今の角度から次にどの角度へ進むかを返す */
export function nextRotation(current: Rotation): Rotation {
  const index = ROTATIONS.indexOf(current);
  return ROTATIONS[(index + 1) % ROTATIONS.length];
}

/**
 * 2端子素子(抵抗・コンデンサ・コイル・電源・スイッチ)の、回転角ごとの端子配置。
 * "a"・"b" はそれぞれ元々(0度)の左端子・右端子を指す固定のIDで、
 * 回転してもIDは変わらず、見た目の位置(Position)だけが変わる
 * （回転してもワイヤーの接続関係がIDベースで維持されるようにするため）。
 */
export const TWO_TERMINAL_HANDLE_POSITIONS: Record<
  Rotation,
  { a: Position; b: Position }
> = {
  0: { a: Position.Left, b: Position.Right },
  90: { a: Position.Top, b: Position.Bottom },
  180: { a: Position.Right, b: Position.Left },
  270: { a: Position.Bottom, b: Position.Top },
};

/** 接地(1端子)の、回転角ごとの端子配置 */
export const GROUND_HANDLE_POSITION: Record<Rotation, Position> = {
  0: Position.Top,
  90: Position.Right,
  180: Position.Bottom,
  270: Position.Left,
};

/** 辺(Position)が縦方向(Left/Right)かどうか。縦方向ならtop%で、横方向ならleft%でオフセットを指定する。 */
export function isVerticalSide(position: Position): boolean {
  return position === Position.Left || position === Position.Right;
}

/**
 * スイッチBの端子(t1..tN、0始まりのindexで指定)を、共通端子と反対側の辺に
 * 均等に並べるときのオフセット(0〜100の割合)。
 * CircuitElementNode.tsx(2DのHandle位置、CSSのtop%/left%にそのまま使う)と、
 * 3Dビュー側の端子座標計算の両方から呼ぶことで、見た目の端子位置がズレないようにする。
 */
export function switchBTerminalOffsetPercent(
  index: number,
  terminalCount: number,
): number {
  return terminalCount === 1 ? 50 : (100 * (index + 1)) / (terminalCount + 1);
}
