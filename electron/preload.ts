import { contextBridge } from "electron";

// 現時点で IPC 要件はないため、将来の拡張用の最小スタブ。
contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
});
