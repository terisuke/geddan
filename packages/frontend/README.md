# DanceFrame Frontend

AI駆動型インタラクティブ動画生成アプリケーションのフロントエンド実装。

## 技術スタック

- **Next.js 16.0** - React フレームワーク
- **React 19.2** - UI ライブラリ
- **TypeScript 5** - 型安全性
- **Tailwind CSS 4** - スタイリング
- **MediaPipe Tasks Vision 0.10.15** - リアルタイム骨格推定
- **Zustand 5.0.8** - 状態管理
- **Framer Motion** - アニメーション
- **Playwright** - E2Eテスト

## セットアップ

### 前提条件

- Node.js 18以上
- npm または yarn

### インストール

```bash
cd packages/frontend
npm install
```

### 開発サーバー起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

### ビルド

```bash
npm run build
```

### 本番サーバー起動

```bash
npm start
```

## 環境変数

`.env.local` ファイルを作成して以下の変数を設定：

```env
# API設定
NEXT_PUBLIC_API_URL=http://localhost:8000

# モックAPI使用（開発・テスト用）
# trueに設定すると、実APIの代わりにモックAPIを使用します
NEXT_PUBLIC_USE_MOCK_API=false
```

## テスト

### E2Eテスト

```bash
# テスト実行（npm run test でも実行可能）
npm run test
# または
npm run test:e2e

# UIモードで実行
npm run test:e2e:ui

# ヘッドモードで実行
npm run test:e2e:headed
```

## プロジェクト構造

```
packages/frontend/
├── app/                    # Next.js App Router
│   ├── page.tsx           # ランディングページ
│   ├── upload/            # アップロードページ
│   ├── analysis/          # 解析進捗ページ
│   ├── capture/           # カメラ撮影ページ
│   ├── review/           # 確認・撮り直しページ
│   ├── generate/         # 動画生成ページ
│   └── download/         # ダウンロードページ
├── components/            # Reactコンポーネント
│   ├── layout/           # レイアウトコンポーネント
│   ├── upload/           # アップロード関連
│   ├── analysis/         # 解析進捗関連
│   ├── camera/           # カメラ撮影関連
│   ├── review/           # レビュー関連
│   └── generate/        # 生成関連
├── hooks/                # カスタムフック
│   ├── useMediaPipe.ts   # MediaPipe統合
│   └── useCamera.ts      # カメラアクセス
├── lib/                  # ユーティリティ
│   ├── api.ts            # APIクライアント
│   ├── api/mock.ts       # モックAPI
│   └── poseComparison.ts # ポーズ類似度計算
├── store/                # Zustandストア
│   └── useAppStore.ts    # アプリケーション状態
├── types/                # TypeScript型定義
└── __tests__/            # テストファイル
    └── e2e/             # E2Eテスト
```

## 主要機能

### 1. 動画アップロード
- ドラッグ&ドロップ対応
- ファイルバリデーション（MP4/GIF、最大100MB）
- アップロード進捗表示

### 2. 動画解析
- リアルタイム進捗表示
- ユニークフレーム検出
- 骨格推定結果の取得

### 3. カメラ撮影
- リアルタイム骨格推定（30+ FPS）
- ポーズ類似度計算
- 自動シャッター（85%以上で発火）
- タイムアウト機能（30秒）

### 4. 確認・撮り直し
- サムネイルグリッド表示
- 拡大表示（モーダル）
- 個別撮り直し機能

### 5. 動画生成
- 生成進捗表示
- ポーリングによるステータス取得

### 6. ダウンロード
- 動画プレビュー
- ダウンロード機能

## パフォーマンス目標

- Lighthouse Performance: 90点以上
- First Contentful Paint: < 1.5s
- 骨格推定: 30+ FPS

## ブラウザサポート

- Chrome/Edge (最新版)
- Firefox (最新版)
- Safari (最新版)

## ライセンス

このプロジェクトはプロプライエタリです。
