"use client";

import dynamic from "next/dynamic";

// AppShellはReact Flow・react-resizable-panelsなど、ブラウザのDOM計測に依存する
// ライブラリを使っているため、サーバー側では描画せずブラウザ側だけで描画する
// (ssr: false)。こうしないと、サーバーが生成した静的HTMLとブラウザでの初回描画が
// 一致せず、ハイドレーションエラーになる。
const AppShell = dynamic(
  () => import("@/components/layout/AppShell").then((m) => m.AppShell),
  { ssr: false },
);

export default function Home() {
  return <AppShell />;
}
