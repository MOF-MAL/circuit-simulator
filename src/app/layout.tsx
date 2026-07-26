import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "電気回路シミュレータ",
  description: "高校物理レベルの電気回路をシミュレーションできるWebアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/*
        画面全体を1つのアプリ画面として使うため、
        ページ自体はスクロールさせず（overflow-hidden）、
        高さは常にビューポート全体（h-full）に固定している。
      */}
      <body className="flex h-full flex-col overflow-hidden">{children}</body>
    </html>
  );
}
