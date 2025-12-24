# FOX SUMMON (狐召喚) 🦊

「コン。」

ハンドサインと音声認識を組み合わせた、没入型 **AR "狐召喚" ジョークアプリ** です。
カメラに向かってあの「狐の手」を作り、言葉を発することで、異界から狐の悪魔を呼び出します。

## 🌐 Demo
[https://fox-summon-gmgbwms8n-iidaatcnts-projects.vercel.app](https://fox-summon-gmgbwms8n-iidaatcnts-projects.vercel.app)

※ カメラとマイクの権限を許可してください。
※ モバイル推奨。

## ✨ 特徴
*   **MediaPipe Hand Tracking**: 高速なAI処理で「狐のハンドサイン」のみを正確に検知してロックオンします。
*   **Voice Trigger**: 「コン！(Kon)」という声をトリガーに演出が発動します。
*   **Immersive AR**: Three.js による迫力ある画面シェイクと召喚エフェクト。

## 🛠 技術スタック
*   **Framework**: React + Vite
*   **3D/VFX**: Three.js, React Three Fiber, Drei
*   **Computer Vision**: MediaPipe Tasks Vision
*   **Motion**: Framer Motion
*   **Styling**: TailwindCSS

## 🚀 開発環境のセットアップ

1.  **リポジトリのクローン**
    ```bash
    git clone https://github.com/iidaatcnt/fox-summon.git
    cd fox-summon
    ```

2.  **依存関係のインストール**
    ```bash
    npm install
    ```

3.  **ローカルサーバーの起動**
    ```bash
    npm run dev
    ```
    ブラウザで `http://localhost:5173` を開きます。

## 🎮 遊び方

1.  アプリを起動し、カメラへのアクセスを許可します。
2.  カメラに向かって、**中指と薬指を親指につけ、人差し指と小指を立てる**（狐の影絵）ポーズを作ります。
3.  画面上のレティクルが赤くなり「FOX SIGN LOCKED」と表示されたら準備完了。
4.  はっきりと短く**「コン！」**と唱えます。
5.  ...何かが起きます。

## 📄 License
MIT

---
*Created by Antigravity*
