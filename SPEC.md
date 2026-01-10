# FOX SUMMON - 技術仕様書 (SPEC.md)

## 概要

「FOX SUMMON」は、人気漫画「チェンソーマン」に登場する「キツネの悪魔」の召喚シーンを再現したインタラクティブWebアプリケーションです。カメラによるハンドジェスチャー認識と音声認識を組み合わせ、ユーザーが実際にキツネを召喚する体験を提供します。

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| 3Dレンダリング | React Three Fiber, Three.js |
| アニメーション | Framer Motion |
| ハンドトラッキング | MediaPipe Hands |
| カメラ | react-webcam |
| 音声認識 | Web Speech API (SpeechRecognition) |
| 音声合成 | Web Audio API |
| デプロイ | Vercel |

## ディレクトリ構成

```
fox-summon/
├── public/
│   ├── fox01.png        # スタンバイ画像（キツネの影）
│   ├── fox02.png        # 攻撃画像（牙を剥くキツネ）
│   ├── fox03.png        # エンディング画像（佇むキツネ）
│   ├── city_bug01.jpg   # 怪物襲来シーン1
│   ├── city_bug02.jpg   # 怪物襲来シーン2
│   └── dead_bug.jpg     # 討伐完了シーン
├── src/
│   ├── app/
│   │   ├── page.tsx     # メインアプリケーション
│   │   ├── layout.tsx   # レイアウト定義
│   │   └── globals.css  # グローバルスタイル
│   └── hooks/
│       └── useHandTracking.ts  # ハンドトラッキングフック
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

## 状態遷移図

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [idle] ──(カメラ起動)──> [detecting] ──(ハンドサイン認識)──>  │
│                                                                 │
│  [locked] ──("こん!"発声)──> [summoning] ──(1.2s)──>           │
│                                                                 │
│  [closeup] ──(1.5s)──> [victory] ──(3s)──> [cooloff] ──(4s)──> │
│                                                                 │
│  [evaporating] ──(5s)──> [done] ──(スペースキー)──> [idle]     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 状態詳細

| 状態 | 説明 | カメラ | 背景 | キツネ画像 |
|------|------|--------|------|------------|
| `idle` | 初期状態、カメラ起動待ち | ON | city_bug01/02 | なし |
| `detecting` | ハンドサイン検出中 | ON | city_bug01/02 | なし |
| `locked` | 召喚スタンバイ | OFF | city_bug01/02 | fox01.png |
| `summoning` | 召喚開始 | OFF | dead_bug.jpg | fox02.png |
| `closeup` | 攻撃クローズアップ | OFF | dead_bug.jpg | fox02.png |
| `victory` | 勝利シーン | OFF | dead_bug.jpg | なし |
| `cooloff` | キツネ佇み | OFF | dead_bug.jpg | fox03.png |
| `evaporating` | キツネ消滅中 | OFF | dead_bug.jpg | fox03.png (フェードアウト) |
| `done` | ミッション完了 | OFF | dead_bug.jpg (グレースケール) | なし |

## 主要コンポーネント

### FoxScene
3Dシーン内でキツネ画像を表示・アニメーションするコンポーネント。

```typescript
const FoxScene = ({ state }: { state: string }) => {
    // 状態に応じてテクスチャ、スケール、透明度を制御
}
```

### useHandTracking
MediaPipe Handsを使用したカスタムフック。

```typescript
const { isFoxHand, handPosition } = useHandTracking(webcamRef, dependency);
```

- `isFoxHand`: キツネのハンドサインが検出されたか
- `handPosition`: 手の位置座標 `{ x: number, y: number }`

### 音声認識
Web Speech APIを使用した日本語音声認識。

```typescript
const FOX_TRIGGER_WORD = ['コン', 'こん'];
recognition.lang = 'ja-JP';
recognition.continuous = true;
recognition.interimResults = true;
```

### 効果音生成
Web Audio APIを使用したプログラマティック効果音。

- **ビルドアップ**: ノコギリ波による不気味な上昇音
- **ウォッシュ**: ノイズバッファによる風切り音
- **インパクト**: 三角波による重低音
- **クランチ**: ノイズによる破壊音
- **リング**: サイン波による余韻

## パフォーマンス考慮事項

1. **カメラ遅延起動**: 起動後1.5秒待機してからカメラを有効化
2. **状態ガード**: 召喚シーケンス中はハンドトラッキングによる状態リセットを防止
3. **アニメーション最適化**: requestAnimationFrameを使用したスムーズなアニメーション
4. **メモリ管理**: useEffectのクリーンアップ関数で適切にリソースを解放

## ブラウザ対応

| ブラウザ | 対応状況 | 備考 |
|----------|----------|------|
| Chrome | ✅ 完全対応 | 推奨 |
| Edge | ✅ 完全対応 | |
| Firefox | ⚠️ 部分対応 | Web Speech APIの制限あり |
| Safari | ⚠️ 部分対応 | webkitSpeechRecognition使用 |

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 本番サーバー起動
npm run start

# リント
npm run lint
```

## 環境変数

特に必要な環境変数はありません。すべての機能はクライアントサイドで動作します。

## 今後の拡張案

1. **複数の悪魔対応**: キツネ以外の悪魔（蛇、蜘蛛など）の召喚
2. **マルチプレイヤー**: 複数ユーザーでの同時召喚体験
3. **AR対応**: WebXRを使用した現実世界への悪魔投影
4. **サウンドエフェクト強化**: 音声ファイルによる高品質効果音
5. **ストーリーモード**: 複数の敵を順番に倒すゲームモード

## ライセンス

MIT License

## 作成者

iidaatcnt

## 更新履歴

| 日付 | バージョン | 変更内容 |
|------|------------|----------|
| 2026-01-10 | 1.0.0 | 初版リリース |
| 2026-01-10 | 1.1.0 | 新しい怪物画像の追加、勝利シーンの実装 |
| 2026-01-10 | 1.2.0 | 状態遷移バグ修正、討伐シーン明確化 |
