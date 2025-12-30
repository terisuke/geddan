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

## 🟢 フェーズ2: カメラキャプチャ機能 `cc:完了`

**目標**: MediaPipe でリアルタイムポーズ検出 → 類似度マッチング → 自動キャプチャ

### Frontend

- [x] MediaPipe Tasks Vision 統合 (`useMediaPipe.ts`) `cc:完了`
- [x] カメラビューコンポーネント (`CameraView.tsx`) `cc:完了`
- [x] ポーズ類似度計算 (`poseComparison.ts`) `cc:完了`
- [x] 自動キャプチャ（70%閾値） `cc:完了`
- [x] キャプチャ画像ストア (`useAppStore.ts`) `cc:完了`
- [x] ターゲット画像からランドマーク抽出 (`extractPoseLandmarks.ts`) `cc:完了`

### 追加改良（バグ修正）

- [x] Gemini APIによるアニメ画像ポーズ抽出 (`geminiPoseService.ts`) `cc:完了`
- [x] ハイブリッドポーズ検出（Gemini優先→MediaPipeフォールバック） `cc:完了`
- [x] ポーズ類似度計算の改良（2D比較・体幹正規化） `cc:完了`
- [x] カメラ準備完了待ち対応 `cc:完了`

### Backend

- [ ] キャプチャ画像受信API `cc:TODO` (Phase 3で実装予定)
- [ ] ポーズマッピング保存 `cc:TODO` (Phase 3で実装予定)

---

## 🟢 フェーズ3: 動画生成 `cc:完了`

**目標**: ユーザーキャプチャ画像 → 動画合成 → ダウンロード

### Backend

- [x] VideoComposer サービス (`video_composer.py`) `cc:完了`
- [x] FFmpeg 動画合成 (`compose_video()`) `cc:完了`
- [x] 音声マージ (`_extract_audio()`) `cc:完了`
- [x] キャプチャ画像受信API (`/api/generate/{job_id}/capture`) `cc:完了`
- [x] 生成開始API (`/api/generate/{job_id}/start`) `cc:完了`
- [x] 生成ステータスAPI (`/api/generate/{job_id}/status`) `cc:完了`
- [x] Celeryタスク (`generate_video_task`) `cc:完了`
- [x] ダウンロードAPI (`/api/download/{job_id}/final.mp4`) `cc:完了`

### Frontend

- [x] レビュー画面 (`app/review/page.tsx`) `cc:完了`
- [x] サムネイルグリッド (`ThumbnailGrid.tsx`) `cc:完了`
- [x] 背景除去処理 (`useCaptureProcessor.ts`) `cc:完了`
- [x] 生成進捗表示 `cc:完了`
- [x] ダウンロードボタン（直接DL対応） `cc:完了`
- [x] 完了メッセージ表示 `cc:完了`

### 統合テスト

- [x] E2Eフロー検証 `cc:完了`
  - レビュー画面E2Eテスト追加 (`review_flow.spec.ts`)
  - ReviewPageリダイレクト修正（データなし→/upload）
  - capture_flow.spec.ts更新

---

## 🔵 フェーズ4: 品質向上・最適化 `cc:WIP`

- [x] E2E テスト拡充 `cc:完了`
  - レビューフローテスト追加
  - ページ保護テスト（リダイレクト検証）
- [ ] パフォーマンス最適化 `cc:TODO`
- [ ] セキュリティ監査 `cc:TODO`
- [ ] Docker Compose 本番設定 `cc:TODO`
- [ ] デプロイ準備（Vercel + Railway） `cc:TODO`

---

## 📝 次のアクション

現在の優先事項:
1. ~~フェーズ1の残タスクを完了させる~~ ✅ 完了
2. ~~フェーズ2: カメラキャプチャ機能~~ ✅ 完了
3. ~~フェーズ3: 動画生成~~ ✅ 完了
4. **フェーズ4: 品質向上・最適化** ← 作業中

### 残タスク

1. ~~**E2Eフロー検証**~~ ✅ 完了
2. ~~**E2Eテスト拡充**~~ ✅ 完了
3. **パフォーマンス最適化** - 動画処理・フロントエンド最適化
4. **セキュリティ監査** - 入力検証・CORS設定
5. **デプロイ準備** - Vercel + Railway

**次に言うこと**: 「パフォーマンス最適化して」または「デプロイ準備して」
