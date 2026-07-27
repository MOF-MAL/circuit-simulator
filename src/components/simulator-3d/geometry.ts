/**
 * 回路メーカーの2Dレイアウト(px単位のフロー座標)を、3Dシーンの座標・ジオメトリに
 * 変換するための純粋関数群。React/Three.jsに依存しない計算だけをここに集める。
 */
import { Position } from "@xyflow/react";
import * as THREE from "three";
import {
  type CircuitElementType,
  ELEMENT_PARAM_DEFS,
  elementTypeLabel,
} from "@/components/circuit-maker/circuit-elements";
import type { CircuitElementNodeType } from "@/components/circuit-maker/nodes/CircuitElementNode";
import {
  GROUND_HANDLE_POSITION,
  isVerticalSide,
  switchBTerminalOffsetPercent,
  TWO_TERMINAL_HANDLE_POSITIONS,
} from "@/components/circuit-maker/rotation";

/** 2DキャンバスのノードサイズがCircuitElementNode.tsxの`h-8 w-8`(32px)であることに対応する定数 */
export const NODE_SIZE_PX = 32;
/** 節点(junction)だけは他の素子より小さい箱(`h-6 w-6`=24px)で表示する */
export const JUNCTION_SIZE_PX = 24;

/**
 * フロー座標(px)→3Dワールド座標のスケール。
 * 40pxのノードがちょうど3D空間で1ユニットの立方体になるように選んでいる。
 * (節点だけ箱のpxサイズが違っても、ワールド座標への変換スケール自体は全素子共通のこの値を使う)
 */
export const FLOW_TO_3D_SCALE = 1 / NODE_SIZE_PX;

/** 素子の種類ごとの、2Dキャンバスでのノードのpxサイズ(節点だけ小さい) */
export function elementSizePx(elementType: CircuitElementType): number {
  return elementType === "junction" ? JUNCTION_SIZE_PX : NODE_SIZE_PX;
}

/** フロー座標(px)上の1点。3D空間ではXZ平面(水平面)上の点として扱う。 */
export type FlowPoint = { x: number; y: number };

/** 2Dの辺(Position)＋辺上の位置(0〜100%)から、ノード矩形上の絶対px座標を求める */
function sideOffsetToPoint(
  centerX: number,
  centerY: number,
  side: Position,
  percentAlongSide: number,
  sizePx: number,
): FlowPoint {
  const half = sizePx / 2;
  const along = (percentAlongSide / 100) * sizePx;
  switch (side) {
    case Position.Left:
      return { x: centerX - half, y: centerY - half + along };
    case Position.Right:
      return { x: centerX + half, y: centerY - half + along };
    case Position.Top:
      return { x: centerX - half + along, y: centerY - half };
    default:
      return { x: centerX - half + along, y: centerY + half };
  }
}

/**
 * 素子の1端子(handleId)の、フロー座標(px)上の絶対位置を求める。
 * CircuitElementNode.tsxが実際にHandleを描画するときのCSSロジック(辺+top%/left%)と
 * 同じ計算を数値で行う(ズレ防止のため、辺の判定・オフセット計算そのものはrotation.tsを共用)。
 */
export function terminalAbsolutePosition(
  node: CircuitElementNodeType,
  handleId: string,
): FlowPoint {
  const { elementType, rotation } = node.data;
  const sizePx = elementSizePx(elementType);
  const centerX = node.position.x + sizePx / 2;
  const centerY = node.position.y + sizePx / 2;

  if (elementType === "junction") {
    // 節点は2D側でも回転角に関わらず箱の中央に端子を固定しているため、そのまま中心点を返す
    return { x: centerX, y: centerY };
  }

  if (elementType === "ground") {
    return sideOffsetToPoint(
      centerX,
      centerY,
      GROUND_HANDLE_POSITION[rotation],
      50,
      sizePx,
    );
  }

  if (elementType === "switch-b") {
    if (handleId === "common") {
      return sideOffsetToPoint(
        centerX,
        centerY,
        TWO_TERMINAL_HANDLE_POSITIONS[rotation].a,
        50,
        sizePx,
      );
    }
    const terminalCount = Math.max(
      1,
      Number(node.data.params.terminalCount) || 1,
    );
    const index = Number(handleId.replace("t", "")) - 1;
    return sideOffsetToPoint(
      centerX,
      centerY,
      TWO_TERMINAL_HANDLE_POSITIONS[rotation].b,
      switchBTerminalOffsetPercent(index, terminalCount),
      sizePx,
    );
  }

  const side =
    handleId === "a"
      ? TWO_TERMINAL_HANDLE_POSITIONS[rotation].a
      : TWO_TERMINAL_HANDLE_POSITIONS[rotation].b;
  return sideOffsetToPoint(centerX, centerY, side, 50, sizePx);
}

/**
 * フロー座標(px)を3DワールドのXZ平面上の点に変換する(高さYは呼び出し側が決める)。
 * 2D側のx・yは、そのままワールドのx・zに対応させる(符号反転なし)。これは、
 * 回路の真上から見たときに2Dキャンバスと同じ向きに見えるようScene3D.tsxのカメラの
 * up方向を選んでいることと、CircuitFloor.tsxのFlatIconが素子を水平に寝かせる
 * 固定回転と対応している。どちらかだけを変えると、素子アイコンの向きや、
 * 真上から見た時の左右・上下が2D表示とズレるので、3点セットで扱うこと。
 */
export function flowToWorldXZ(point: FlowPoint): [number, number] {
  return [point.x * FLOW_TO_3D_SCALE, point.y * FLOW_TO_3D_SCALE];
}

/** 辺(isVerticalSide判定)を利用するため、rotation.tsの関数をそのまま再エクスポートしておく */
export { isVerticalSide };

/**
 * 2点(from→to)を結ぶ棒状ジオメトリ(帯・管など)の位置・向き・長さを求める。
 * `localAxis`は、そのジオメトリの「長さ」方向がローカル座標のどの軸かを指定する
 * (BoxGeometryは長さがX軸方向、CylinderGeometryは高さがY軸方向のため)。
 */
export function segmentTransform(
  from: THREE.Vector3,
  to: THREE.Vector3,
  localAxis: THREE.Vector3 = new THREE.Vector3(1, 0, 0),
): { position: THREE.Vector3; quaternion: THREE.Quaternion; length: number } {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  const position = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion();
  if (length > 1e-9) {
    quaternion.setFromUnitVectors(localAxis, direction.clone().normalize());
  }
  return { position, quaternion, length };
}

/**
 * 素子情報モード用の表示ラベル("R1: 100 Ω"など)を作る。
 * ELEMENT_PARAM_DEFS(素子ごとのパラメータ定義)をそのまま参照するデータ駆動な作り方にすることで、
 * 素子の種類が増えてもここを個別に直す必要がないようにしている。
 */
export function formatElementLabel(node: CircuitElementNodeType): string {
  const { elementType, name, params } = node.data;

  if (elementType === "ground") return name;

  if (elementType === "switch-a") {
    return `${name}: ${params.closed ? "ON" : "OFF"}`;
  }

  if (elementType === "switch-b") {
    const connected = Number(params.connectedTerminal) || 0;
    return `${name}: ${connected === 0 ? "未接続" : `端子${connected}`}`;
  }

  const paramText = ELEMENT_PARAM_DEFS[elementType]
    .filter((def) => def.kind === "number")
    .map((def) => `${params[def.key]}${def.unit}`)
    .join(", ");
  return paramText ? `${name}: ${paramText}` : name;
}

/** デバッグ・凡例表示などで種類名だけ欲しいときのために再エクスポート */
export { elementTypeLabel };
