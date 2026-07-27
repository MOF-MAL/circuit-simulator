# 電気回路シミュレータ

回路図を2Dで組み立て、MNA(修正節点解析)+後退オイラー法による過渡解析でシミュレーションし、その結果を3Dビューで可視化できるNext.js製のWebアプリです。

## 主な機能

- **回路メーカーエリア**: ドラッグ&ドロップで素子を配置し、端子同士をつないで回路図を作成([@xyflow/react](https://reactflow.dev/)ベース)。配置したときと同じ見た目のままカーソルに追従するドラッグ操作(Scratch風)や、クリックでの配置にも対応。編集モード/消しゴムモード(クリックで素子・ワイヤーを削除)の切り替えと、回路を一括で消去するクリアボタンをキャンバス上に備える。
- **対応素子**: 抵抗・コンデンサ・コイル・直流電源・交流電源・スイッチA(単純なON/OFF)・スイッチB(多端子切り替え)・電流計・電圧計・節点(配線の合流・分流点)・アース。
- **回路セッティングエリア**: 選択中の素子の名前・向き・パラメータ(抵抗値、電圧など)を編集。
- **回路シミュレータエリア(3Dビュー)**: 回路図をそのまま3D空間に配置し、以下の4モードで可視化。配線がつながっていない・スイッチがオフなど「回路がオンになっていない」素子には、いずれのモードでもエフェクトを表示しない。
  - 電位モード: 各点の電位の高さを半透明の壁で表現
  - 電流モード: 赤い粒子の速さで電流の大きさ、向きで電流の向きを表現(粒子の間隔は区間の長さで決まり、電流の大きさには依存しない)
  - 電力モード: 抵抗の発熱(消費電力)をヒートカラーで表現
  - 素子情報モード: 各素子の名前・パラメータをラベル表示
- **回路データエリア**: 各素子の電圧・電流を表・グラフ([recharts](https://recharts.org/))で確認。
- **タイムマネージャー**: シミュレーションの再生・一時停止・任意時刻へのシーク。
- **保存/読み込み**: ブラウザへの自動保存(localStorage)に加え、名前を付けてJSONファイルとして保存・読み込みが可能。

## 技術スタック

- [Next.js](https://nextjs.org/) 16 (App Router / Turbopack)
- [React](https://react.dev/) 19 / TypeScript
- [Tailwind CSS](https://tailwindcss.com/) 4
- [@xyflow/react](https://reactflow.dev/) (2Dの回路キャンバス)
- [@react-three/fiber](https://r3f.docs.pmnd.rs/) / [@react-three/drei](https://github.com/pmndrs/drei) / [three](https://threejs.org/) (3Dビュー)
- [recharts](https://recharts.org/) (グラフ表示)
- [mathjs](https://mathjs.org/) (連立方程式の求解)
- [Biome](https://biomejs.dev/) (lint / format)
- 回路シミュレーション本体(MNA + 後退オイラー法)は外部ライブラリを使わない自前実装([src/lib/circuit-solver](src/lib/circuit-solver))

## セットアップ・開発

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開くと画面が表示されます。

## コマンド一覧

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | 本番用ビルド |
| `npm run start` | ビルド済みアプリの起動(要`npm run build`実行済み) |
| `npm run lint` | Biomeによるlintチェック |
| `npm run format` | Biomeによる自動整形 |

## デプロイ

このアプリはシミュレーション計算・保存処理をすべてブラウザ側(クライアントサイド)で行っており、バックエンドAPI・データベース・環境変数のいずれも必要ありません。そのため、Next.jsに対応した任意の環境へそのままデプロイできます。

- **[Vercel](https://vercel.com/)**: リポジトリをインポートするだけで、追加設定なしにデプロイできます。
- **その他のNode対応環境**: `npm run build`でビルドした後、`npm run start`で起動できます。

## ディレクトリ構成

```
src/
  app/                      # Next.js App Routerのエントリーポイント
  components/
    layout/                 # 画面全体のレイアウト(ヘッダー・5エリアの分割)
    circuit-maker/           # 回路メーカーエリア(2Dキャンバス・素子アイコン・回転ロジック)
    settings/                # 回路セッティングエリア(素子パラメータ編集)
    simulation/              # シミュレーションの再生状態管理(SimulationProvider)
    simulator-3d/            # 回路シミュレータエリア(3Dビュー、モード別コンポーネント)
    data-panel/              # 回路データエリア(表・グラフ)
    time-manager/            # タイムマネージャー(再生・シーク)
  lib/
    circuit-solver/          # MNA + 後退オイラー法によるシミュレーション本体
    circuit-storage.ts        # localStorage自動保存・JSONファイルの保存/読み込み
```
