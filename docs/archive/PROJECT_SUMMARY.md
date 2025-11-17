# DanceFrame - プロジェクトサマリー 📊

**作成日**: 2025-11-16
**チーム**: Claude (Lead) + Cursor (Developer)
**ステータス**: ✅ 計画完了 → 実装開始可能

---

## 🎯 プロジェクト概要

### コンセプト
**「手描きアニメーションと踊る」**

手描きループアニメーション動画から原画を抽出し、ユーザーが同じポーズを撮影することで「自分が踊ってみた」風の動画を自動生成するWebアプリケーション。

### 主要機能
1. **動画アップロード** - MP4/GIF対応（最大100MB）
2. **自動解析** - AI骨格推定でユニークポーズ検出
3. **リアルタイム撮影** - カメラで自動ポーズマッチング
4. **動画生成** - 撮影画像と音源を自動合成

### 技術的特徴
- 🤖 **最新AI技術**: MediaPipe Tasks Vision（2025年1月更新）
- ⚡ **高速化**: Next.js 16 Turbopack（5-10倍高速）
- 🎨 **モダンUI**: React 19.2 + Tailwind CSS
- 🔄 **非同期処理**: Celery + Redis

---

## 📚 完成ドキュメント一覧

### 1. コアドキュメント（7件、175KB）

| ドキュメント | サイズ | 用途 | 対象 |
|------------|--------|------|------|
| **README.md** | 13KB | プロジェクト概要・クイックスタート | 全員 |
| **SPECIFICATION_V2.md** | 60KB | 技術仕様書（2025年版） | 開発者 |
| **IMPLEMENTATION_PLAN.md** | 41KB | 実装計画（15-20日） | 開発者 |
| **ARCHITECTURE.md** | 18KB | システム設計・アーキテクチャ | Lead/Architect |
| **SETUP.md** | 11KB | 環境構築ガイド | 開発者 |
| **TEAM_WORKFLOW.md** | 13KB | チーム開発フロー（2人体制） | 全員 |
| **DIVISION_OF_LABOR.md** | 22KB | 詳細役割分担表 | 全員 |
| **KICKOFF.md** | 11KB | キックオフドキュメント | 全員 |

**合計**: 189KB、約1,850行

---

## 👥 チーム体制と役割分担

### Claude (Technical Lead / Backend Specialist)

**担当領域（70% Backend）:**
- ✅ Backend API設計・実装（FastAPI）
- ✅ 動画処理エンジン（FFmpeg、imagehash、MediaPipe）
- ✅ Celeryバックグラウンドタスク
- ✅ インフラ設定（Railway、Redis）
- ✅ コードレビュー・技術サポート

**工数**: 35-41時間（Phase 0-6）

---

### Cursor (Full-stack Developer / Frontend Specialist)

**担当領域（70% Frontend）:**
- ✅ Frontend UI/UX実装（Next.js 16 + React 19.2）
- ✅ MediaPipe Tasks Vision統合（ブラウザ版）
- ✅ カメラ・撮影機能
- ✅ E2Eテスト（Playwright）
- ✅ デプロイ（Vercel）

**工数**: 40-48時間（Phase 0-6）

---

## 📅 スケジュール（10-12営業日）

### Week 1: Foundation (Day 1-5)
```
Day 1  : 環境セットアップ（Claude: Backend, Cursor: Frontend）
Day 2  : 動画アップロード機能（Claude: API, Cursor: UI）
Day 3  : 解析エンジン実装（Claude: メイン, Cursor: サポート）
Day 4  : カメラ統合開始（Cursor: メイン, Claude: ロジック）
Day 5  : ポーズマッチング（Cursor: UI, Claude: 計算）
```

### Week 2: Core Features (Day 6-10)
```
Day 6  : 撮影UI完成（Cursor: メイン）
Day 7  : 確認・撮り直し機能（Cursor: メイン）
Day 8  : 動画生成機能（Claude: メイン）
Day 9  : E2Eテスト・バグ修正（両者）
Day 10 : UI/UXブラッシュアップ（Cursor: メイン）
```

### Week 3: Release (Day 11-12)
```
Day 11 : デプロイ準備（Claude: Railway, Cursor: Vercel）
Day 12 : 本番リリース・検証（両者）
```

---

## 🛠️ 技術スタック（2025年最新版）

### Frontend（すべて2025年最新）
```yaml
Framework: Next.js 16.0          # Turbopack安定版
UI Library: React 19.2           # React Compiler対応
Language: TypeScript 5.3+
AI Engine: MediaPipe Tasks-Vision 0.10.15  # ⚠️ 旧APIは非推奨
State: Zustand 5.0.8             # 2025年8月最新
Styling: Tailwind CSS 3.4
Animation: Framer Motion 11.0
```

### Backend（本番環境対応）
```yaml
Framework: FastAPI 0.115
Task Queue: Celery 5.4           # ⚠️ 新規追加（重要）
Message Broker: Redis 7.2
Language: Python 3.11+
Video Processing: FFmpeg 6.1
AI Engine: MediaPipe 0.10.14
Image Hash: imagehash 4.3.1
```

### Infrastructure
```yaml
Frontend Hosting: Vercel
Backend Hosting: Railway / Render
Container: Docker + Docker Compose
CI/CD: GitHub Actions
```

---

## 🔍 技術調査結果（公式ドキュメント準拠）

### 重大な変更点（v1.0 → v2.0）

#### 1. MediaPipe 移行（最重要） 🔴
```diff
- ❌ @mediapipe/pose (2023年3月サポート終了)
+ ✅ @mediapipe/tasks-vision 0.10.15 (2025年1月更新)
```

**根拠:**
- 公式: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- 最終確認: 2025-01-13

**影響:**
- API が完全に変更
- GPU加速の最適化
- 性能向上

---

#### 2. Next.js アップグレード ⚡
```diff
- ❌ Next.js 14.2.x
+ ✅ Next.js 16.0 (2025年10月リリース)
```

**メリット:**
- Turbopack安定版（ビルド5-10倍高速）
- React Compiler統合
- PPR（Partial Pre-Rendering）

---

#### 3. Celery 追加（アーキテクチャ変更） 🔄
```diff
+ ✅ Celery 5.4 + Redis 7.2
```

**理由:**
- CPU集約的な動画処理を非同期化
- ユーザー体験向上（即座のレスポンス）
- スケーラビリティ確保

**根拠:**
- FastAPI Best Practices 2025
- 動画処理パイプライン標準構成

---

## 📊 見積もりサマリー

### 開発期間
```
元の計画 (1人): 15-20営業日
新の計画 (2人): 10-12営業日  (-40% 短縮)
```

### 工数配分
```
Claude:  35-41時間 (Backend中心)
Cursor:  40-48時間 (Frontend中心)
合計:    75-89時間
```

### 並行作業による効率化
```
Phase 1-2: 60%が並行作業可能 → 1.6倍高速化
Phase 3-4: 40%が並行作業可能 → 1.4倍高速化
Phase 5-6: 80%が並行作業可能 → 1.8倍高速化
```

---

## ✅ 完了基準

### MVP（最小機能製品）
- [x] 技術仕様書完成
- [x] 実装計画完成
- [x] チーム体制確立
- [ ] 環境構築完了
- [ ] 全機能実装
- [ ] テストカバレッジ達成
  - Backend: 80%+
  - Frontend: 70%+
  - E2E: 100% (Critical Path)
- [ ] 本番デプロイ成功

### 品質基準
- [ ] パフォーマンス
  - 10秒動画を30秒以内で処理
  - Lighthouse スコア 90点以上
  - 骨格推定 30+ FPS
- [ ] セキュリティ
  - ファイル検証
  - Rate Limiting (10 req/min/IP)
  - CORS設定
- [ ] UX
  - レスポンシブデザイン
  - アクセシビリティ WCAG AA
  - クロスブラウザ対応

---

## 🚀 次のアクション（即座に開始可能）

### Day 1 - 環境セットアップ（2人で4時間）

**Claude (2時間):**
```bash
# 1. リポジトリ構造作成
mkdir -p packages/backend/app/{routers,services,tasks,models}

# 2. Backend初期化
cd packages/backend
python3.11 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn celery redis

# 3. Hello World API
# app/main.py 作成
uvicorn app.main:app --reload

# 確認: http://localhost:8000/docs
```

**Cursor (2時間):**
```bash
# 1. Frontend初期化
cd packages/frontend
npx create-next-app@latest . --typescript --tailwind --app

# 2. 依存関係追加
npm install @mediapipe/tasks-vision@0.10.15 zustand@5.0.8 axios

# 3. 基本レイアウト作成
# app/layout.tsx 実装

# 確認: http://localhost:3000
```

---

## 📚 推奨学習リソース

### Cursor が読むべきドキュメント（優先度順）
1. **DIVISION_OF_LABOR.md** - 自分の担当範囲
2. **KICKOFF.md** - 初日のタスク
3. **TEAM_WORKFLOW.md** - 開発フロー
4. **SPECIFICATION_V2.md** (Frontend部分) - 実装例

### 外部リソース
- [MediaPipe Tasks Vision (Web)](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js)
- [Next.js 16 Documentation](https://nextjs.org/docs)
- [Zustand Guide](https://zustand.docs.pmnd.rs/)

---

## 💬 コミュニケーション

### 日次（毎朝9:00）
**GitHub Issue でスタンドアップ:**
```markdown
## Daily Standup - YYYY-MM-DD

### Claude
- Yesterday: [やったこと]
- Today: [やること]
- Blockers: [困っていること]

### Cursor
- Yesterday: [やったこと]
- Today: [やること]
- Blockers: [困っていること]
```

### 質問・相談
- **GitHub Issue**: 仕様確認、技術議論
- **Slack/Discord**: 緊急時、即答が必要な場合
- **PR Review**: コードレビュー（6時間以内に対応）

---

## 🎉 期待される成果

### 技術的成果
✅ 最新技術スタックの実践経験
✅ AI/ML統合の実装経験
✅ マイクロサービス的アーキテクチャ
✅ 2人開発フローの確立

### プロダクト成果
✅ 実用的なWebアプリケーション
✅ ユニークな体験価値
✅ 高品質なコードベース
✅ 包括的なドキュメント

---

## 📝 備考

### プロジェクトの特徴
- ✅ **完全なドキュメント化**: 仕様・設計・実装計画がすべて文書化
- ✅ **2025年最新技術**: 公式ドキュメント10件以上を調査・検証
- ✅ **明確な役割分担**: Claude/Cursor それぞれの強みを活かす
- ✅ **効率的なワークフロー**: 並行作業で40%短縮

### 成功の鍵
1. **コミュニケーション**: 毎日のスタンドアップ
2. **品質重視**: テストカバレッジ目標達成
3. **継続的改善**: 週次レトロスペクティブ

---

## 🏁 スタート宣言

**準備完了！実装を開始できます。**

```bash
# Claude
cd dance-frame/packages/backend
source venv/bin/activate
uvicorn app.main:app --reload

# Cursor
cd dance-frame/packages/frontend
npm run dev
```

**Let's build something amazing together! 🚀**

---

**Document Version**: 1.0
**Created**: 2025-11-16
**Team**: Claude (Lead) + Cursor (Developer)
**Status**: ✅ Ready to Start
