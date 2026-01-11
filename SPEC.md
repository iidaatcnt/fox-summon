# FOX SUMMON - 技術仕様書 (SPEC.md)

## 概要

「FOX SUMMON」は、カメラによるハンドジェスチャー認識と音声認識を組み合わせたインタラクティブWebアプリケーションです。V2では「Hero Alliance」をコンセプトに、より没入感の高いシネマティックなUIと、モバイル環境での完全な動作を追求しました。

## 技術スタック

| カテゴリ | 技術 | 備考 |
|---------|------|------|
| フロントエンド | Next.js 15 (App Router) | React 19ベース |
| 3Dエンジン | Three.js / React Three Fiber | `@react-three/drei` を併用 |
| アニメーション | Framer Motion | 2D/3Dのシームレスな遷移 |
| ビジョン | MediaPipe Hands | `useHandTracking` カスタムフック |
| 音声認識 | Web Speech API | モバイル向けの高度なパッチ適用済み |
| オーディオ | Web Audio API / HTMLAudioElement | 動的なBGMクロスフェード、プログラマティックSE |

## ディレクトリ構成

```
fox-summon/
├── public/
│   ├── hand_fox.png      # NEW: 実写ベースのハンドサインガイド
│   ├── fox01~03.png     # キツネのアセット（03は全身像）
│   ├── city_bug01~02.jpg # 探索用背景
│   └── dead_bug.jpg     # 勝利背景（怪物の死骸）
├── src/
│   ├── app/
│   │   ├── page.tsx     # コアロジック・UI
│   │   └── globals.css   # スキャンライン・HUDエフェクト
│   └── hooks/
│       └── useHandTracking.ts # ハンドトラッキングロジック
```

## 状態遷移と操作系 (V2)

```
[idle] ──(Tap/Space/Auto)──> [detecting] ──(Hand Align)──> [locked]
   ↑                                                        │
   │                                                        ▼
[done] <──(Reset)── [evaporating] <──(5s)── [victory] <──(Voice/Tap)
```

### 操作の冗長化 (Accessibility)
- **PC**: スペースキーですべての状態遷移（開始、リトライ）に対応。
- **モバイル**: 全画面透明レイヤー（`z-index: 100`）により、タップのみで全工程を完結可能。

## V2 コアテクノロジー

### 1. 高度な音声トリガーロジック
モバイル環境でのGoogle音声入力の揺れを考慮し、単純な文字列一致から以下のハイブリッド判定へアップグレード：
- **同音異義語辞書**: 「今」「婚」「混」「come」「corn」等をトリガーとして登録。
- **音パターン判定**: 正規表現 `/k[oaui]n/` により、子音+母音+鼻音のパターンを抽出。
- **フォールバック**: 音声不能な環境（騒音下）向けに、画面タップによる強制発動をサポート。

### 2. インテリジェント・ハンドガイド
従来のSVGパスでは「ウサギ」や「キツネ面」に見えてしまう混乱を避けるため、**実写ベースの透過シルエット (`hand_fox.png`)** を採用：
- CSS `invert`, `sepia`, `hue-rotate` によるリアクティブな色調補正。
- 指の隙間に合わせた「目の同期ポイント（パルスエフェクト）」により、手の奥行きと角度の正確なガイドを実現。

### 3. シネマティックHUD
- **Heroic Cyan Theme**: UIカラーを `#ff5e00`（警告色）から、ヒーローの絆を象徴する `#22d3ee`（シアン）に刷新。
- **最小化HUD**: 命令パネルを小型化し、没入感を維持しつつ「Acoustic Monitoring」等のシステム稼働状況を提示。

## 状態詳細 (V2)

| 状態名 | 映像ソース | 背景 | 主なエフェクト |
|--------|------------|------|----------------|
| `booting` | ロゴ/Status | - | パーティクル、起動ログ |
| `idle` | Webcam | City (Live) | ハンドガイド表示 |
| `locked` | Freeze | City (Static) | 3Dキツネ、ささやきボイス |
| `summoning` | Overlay | Dead Bug | 画面振動、巨大な牙 |
| `victory` | Overlay | Dead Bug | 「KON!」テキスト、歓喜 |
| `cooloff` | Overlay | Dead Bug | キツネ全身像、平和 |
| `done` | Grayscale | Dead Bug | 暗転、再起動待機 |

## 更新履歴

| バージョン | 日付 | 内容 |
|------------|------|------|
| 1.0.0 | 2026-01-10 | 初期リリース。基本的召喚サイクル。 |
| 1.5.0 | 2026-01-10 | 勝利背景、BGM、リトライ機能追加。 |
| 2.0.0 | 2026-01-11 | **HERO ALLIANCE V2**。シアンテーマ化、モバイル完全対応、実写ハンドガイド、音声認識ロジック強化、UIブラッシュアップ。 |

---
**FOX SUMMON Core Development Team**
 iidaatcnt - Lead Engineer / Creative Director
