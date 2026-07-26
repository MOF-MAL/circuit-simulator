/**
 * 画面最上部のメニューバー。
 * リサイズ対象のエリアではなく、常に高さ固定で表示され続ける。
 */
export function AppHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
      {/*
        メニューボタン。
        将来的に「回路のセーブ・ロード」機能をここに実装する予定。
        現時点では見た目だけのプレースホルダー。
      */}
      <button
        type="button"
        aria-label="メニューを開く"
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
    </header>
  );
}
