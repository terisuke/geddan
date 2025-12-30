# Plans.md - DanceFrame 開発計画

> **プロジェクト**: DanceFrame (geddan)
> **更新日時**: 2025-12-30
> **モード**: Solo (Claude Code)

---

## 📋 マーカー凡例

| マーカー | 状態 | 説明 |
|---------|------|------|
| `cc:TODO` | 未着手 | 実行予定 |
| `cc:WIP` | 作業中 | 実装中 |
| `cc:blocked` | ブロック中 | 依存タスク待ち |
| `cc:完了` | 完了 | 実装済み |

---

## 🟢 フェーズ1: 基盤構築（アップロード→解析パイプライン）`cc:完了`

**目標**: アップロード→フレーム抽出→pHashクラスタ→サムネ表示をローカルで完走させる

### Backend

- [x] FastAPI エントリーポイント構築 (`app/main.py`) `cc:完了`
- [x] アップロードAPI (`/api/upload`) `cc:完了`
- [x] FFmpeg フレーム抽出サービス (`frame_extractor.py`) `cc:完了`
- [x] pHash クラスタリング (`hash_analyzer.py`) `cc:完了`
- [x] 解析ステータスAPI (`/api/analyze/{job_id}`) `cc:完了`
- [x] Celery タスク統合テスト `cc:完了`
- [x] Redis 接続安定化（リトライ・コネクションプール） `cc:完了`

### Frontend

- [x] アップロードコンポーネント `cc:完了`
- [x] 解析進捗ポーリング `cc:完了`
- [x] サムネイルグリッド表示 `cc:完了`
- [x] エラーハンドリング改善（Toast通知・リトライロジック・ErrorBoundary） `cc:完了`

---

## 🟡 フェーズ2: カメラキャプチャ機能 `cc:TODO`

**目標**: MediaPipe でリアルタイムポーズ検出 → 類似度マッチング → 自動キャプチャ

### Frontend

- [ ] MediaPipe Tasks Vision 統合 (`useMediaPipe.ts`) `cc:TODO`
- [ ] カメラビューコンポーネント (`CameraView.tsx`) `cc:TODO`
- [ ] ポーズ類似度計算 (`poseComparison.ts`) `cc:TODO`
- [ ] 自動キャプチャ（85%閾値） `cc:TODO`
- [ ] キャプチャ画像ストア (`useAppStore.ts`) `cc:TODO`

### Backend

- [ ] キャプチャ画像受信API `cc:TODO`
- [ ] ポーズマッピング保存 `cc:TODO`

---

## 🟢 フェーズ3: 動画生成 `cc:TODO`

**目標**: ユーザーキャプチャ画像 → 動画合成 → ダウンロード

### Backend

- [ ] VideoComposer サービス `cc:TODO`
- [ ] FFmpeg 動画合成 `cc:TODO`
- [ ] 音声マージ `cc:TODO`
- [ ] 生成ステータスAPI `cc:TODO`
- [ ] ダウンロードAPI `cc:TODO`

### Frontend

- [ ] レビュー画面 `cc:TODO`
- [ ] 生成進捗表示 `cc:TODO`
- [ ] ダウンロードボタン `cc:TODO`

---

## 🔵 フェーズ4: 品質向上・最適化 `cc:TODO`

- [ ] E2E テスト拡充 `cc:TODO`
- [ ] パフォーマンス最適化 `cc:TODO`
- [ ] セキュリティ監査 `cc:TODO`
- [ ] Docker Compose 本番設定 `cc:TODO`
- [ ] デプロイ準備（Vercel + Railway） `cc:TODO`

---

## 📝 次のアクション

現在の優先事項:
1. ~~フェーズ1の残タスクを完了させる~~ ✅ 完了
2. **フェーズ2: カメラキャプチャ機能に着手**
   - MediaPipe Tasks Vision 統合
   - カメラビューコンポーネント
   - ポーズ類似度計算

**次に言うこと**: 「フェーズ2を始めて」または「カメラ機能を実装して」
