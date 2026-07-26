"use client";

import { useRef } from "react";

/**
 * 「今まで観測した最大値」を保持するフック。resetKeyが変わったら0からやり直す
 * (回路のトポロジーが変わったとき、電位・電流・電力の正規化基準をリセットするため)。
 *
 * 瞬間値だけを基準に正規化すると、交流回路で値がゼロ点付近を通過するたびに
 * 基準値が急に縮んで表示が激しくチラつく。「これまでの最大値」を基準にすることで、
 * 基準値は単調に大きくなるだけになり、表示がなだらかに変化するようにする。
 */
export function useRunningMax(candidate: number, resetKey: unknown): number {
  const resetKeyRef = useRef(resetKey);
  const maxRef = useRef(0);

  if (resetKeyRef.current !== resetKey) {
    resetKeyRef.current = resetKey;
    maxRef.current = 0;
  }
  if (Number.isFinite(candidate)) {
    maxRef.current = Math.max(maxRef.current, candidate);
  }
  return maxRef.current;
}
