"use client";

import { useReactFlow } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import type { CircuitElementNodeType } from "@/components/circuit-maker/nodes/CircuitElementNode";
import {
  downloadAsJsonFile,
  loadFromLocalStorage,
  parseCircuitFile,
  saveToLocalStorage,
} from "@/lib/circuit-storage";

/**
 * 画面最上部のメニューバー。
 * リサイズ対象のエリアではなく、常に高さ固定で表示され続ける。
 *
 * 回路のセーブ・ロード機能をここに実装している。
 * ReactFlowProvider は AppShell.tsx 側でこのコンポーネントごと引き上げてあるため、
 * useReactFlow() で回路メーカーエリアと同じノード/エッジのストアを直接読み書きできる。
 */
export function AppHeader() {
  const { getNodes, getEdges, setNodes, setEdges } =
    useReactFlow<CircuitElementNodeType>();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 起動時に一度だけ、ブラウザキャッシュに保存済みの回路があれば自動的に復元する
  // (無ければ CircuitCanvas.tsx 側の既定値(アースのみ)のまま)。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 起動時に1回だけ実行したいため、意図的に空配列にしている
  useEffect(() => {
    const saved = loadFromLocalStorage();
    if (saved) {
      setNodes(saved.nodes);
      setEdges(saved.edges);
    }
  }, []);

  const handleSave = () => {
    saveToLocalStorage(getNodes(), getEdges());
    setSavedMessage("保存しました");
    setTimeout(() => setSavedMessage(null), 2000);
  };

  // Ctrl+S (Macでは Cmd+S) で保存できるようにする。ブラウザ標準の「ページを保存」ダイアログは止める。
  // getNodes/getEdges(useReactFlow由来)は常に最新のストアを読む安定した関数のため、
  // マウント時に1度だけ登録すれば十分(再登録は不要)。
  // biome-ignore lint/correctness/useExhaustiveDependencies: handleSaveは安定したgetNodes/getEdges/setSavedMessageのみを閉じ込めているため、空配列でよい
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSaveAs = () => {
    const name = window.prompt("回路の名前を入力してください", "回路");
    if (!name) return;
    downloadAsJsonFile(name, getNodes(), getEdges());
    setIsMenuOpen(false);
  };

  const handleLoadClick = () => {
    setLoadError(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const text = await file.text();
    const saved = parseCircuitFile(text);
    if (!saved) {
      setLoadError("読み込みに失敗しました(ファイルの形式が正しくありません)");
      return;
    }
    setNodes(saved.nodes);
    setEdges(saved.edges);
    setIsMenuOpen(false);
  };

  return (
    <header className="relative flex h-12 shrink-0 items-center gap-3 border-b border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        aria-label="メニューを開く"
        onClick={() => setIsMenuOpen((current) => !current)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          role="img"
          aria-hidden
        >
          <title>メニュー</title>
          <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <h1 className="text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-100">
        電気回路シミュレータ
      </h1>

      {savedMessage && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400">
          {savedMessage}
        </span>
      )}

      {isMenuOpen && (
        <>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: メニュー外クリックで閉じるための透明な背景であり、クリック以外の操作対象ではないため適切なroleが存在しない */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: 同上 */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="absolute top-11 left-3 z-20 flex w-48 flex-col rounded-md border border-slate-300 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => {
                handleSave();
                setIsMenuOpen(false);
              }}
              className="px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              保存 (Ctrl+S)
            </button>
            <button
              type="button"
              onClick={handleSaveAs}
              className="px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              名前を付けて保存(JSON)
            </button>
            <button
              type="button"
              onClick={handleLoadClick}
              className="px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              読み込む(JSON)
            </button>
            {loadError && (
              <p className="px-3 py-1 text-xs text-red-500">{loadError}</p>
            )}
          </div>
        </>
      )}

      {/* ファイル選択ダイアログを表示するためだけの、非表示のinput */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFileSelected}
      />
    </header>
  );
}
