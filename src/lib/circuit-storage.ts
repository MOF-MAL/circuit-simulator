import type { Edge } from "@xyflow/react";
import type { CircuitElementNodeType } from "@/components/circuit-maker/nodes/CircuitElementNode";

/** ブラウザキャッシュ(localStorage)に即時保存する際に使う固定キー */
const LOCAL_STORAGE_KEY = "circuit-simulator:autosave";

/** 保存・読み込みするファイル/localStorageの中身の形式 */
export type SavedCircuit = {
  version: 1;
  /** 「名前を付けて保存」のときだけ入る、ユーザーが付けた回路名 */
  name?: string;
  savedAt: string;
  nodes: CircuitElementNodeType[];
  edges: Edge[];
};

/** 現在の回路を、ブラウザキャッシュ(localStorage)に即時保存する */
export function saveToLocalStorage(
  nodes: CircuitElementNodeType[],
  edges: Edge[],
): void {
  const payload: SavedCircuit = {
    version: 1,
    savedAt: new Date().toISOString(),
    nodes,
    edges,
  };
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
}

/** ブラウザキャッシュに保存済みの回路があれば読み出す(無い・壊れていればnull) */
export function loadFromLocalStorage(): SavedCircuit | null {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedCircuit;
  } catch {
    return null;
  }
}

/** 現在の回路に名前を付けて、JSONファイルとしてダウンロードする */
export function downloadAsJsonFile(
  name: string,
  nodes: CircuitElementNodeType[],
  edges: Edge[],
): void {
  const payload: SavedCircuit = {
    version: 1,
    name,
    savedAt: new Date().toISOString(),
    nodes,
    edges,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name || "circuit"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/** 読み込んだJSONファイルの中身が回路データとして妥当か簡易チェックしつつパースする */
export function parseCircuitFile(jsonText: string): SavedCircuit | null {
  try {
    const parsed = JSON.parse(jsonText);
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.nodes) &&
      Array.isArray(parsed.edges)
    ) {
      return parsed as SavedCircuit;
    }
    return null;
  } catch {
    return null;
  }
}
