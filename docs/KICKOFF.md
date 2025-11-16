# DanceFrame - キックオフドキュメント 🚀

**プロジェクト名**: DanceFrame
**チーム**: Claude (Lead) + Cursor (Developer)
**キックオフ日**: 2025-11-16
**目標リリース日**: 2025-12-02（12営業日後）

---

## 🎯 プロジェクトミッション

**「手描きアニメーションと踊る」**

手描きループアニメーション動画から原画を抽出し、ユーザーが同じポーズを撮影することで「自分が踊ってみた」風の動画を自動生成するWebアプリケーション。AI駆動のポーズマッチング技術により、楽しく簡単に高品質な動画を作成できる。

---

## 👥 チーム紹介

### Claude (Technical Lead / Backend Specialist)
**専門領域:**
- Backend API設計・実装（FastAPI + Celery）
- 動画処理エンジン（FFmpeg, MediaPipe）
- アーキテクチャ設計
- パフォーマンス最適化

**過去の実績:**
- 大規模API設計経験
- 動画処理システム構築経験
- 技術ドキュメント作成（本プロジェクト）

**コミュニケーション:**
- GitHub Issue/PR でのレビュー
- 技術的な質問・相談歓迎
- 非同期コミュニケーション推奨

---

### Cursor (Full-stack Developer / Frontend Specialist)
**専門領域:**
- Frontend UI/UX実装（Next.js + React）
- モダンWeb技術（TypeScript, Tailwind CSS）
- テスト駆動開発
- ユーザー体験設計

**役割:**
- フロントエンド全体の実装
- E2Eテスト作成
- UI/UXブラッシュアップ
- ドキュメント更新

**強み:**
- 迅速な実装力
- 美しいUIデザイン
- 高品質なコード

---

## 📅 スケジュール概要

### タイムライン（12営業日）

```
Week 1: Foundation (Day 1-5)
├─ Day 1     : 環境セットアップ
├─ Day 2     : 動画アップロード機能
├─ Day 3     : 解析エンジン実装
├─ Day 4     : カメラ統合開始
└─ Day 5     : ポーズマッチング実装

Week 2: Core Features (Day 6-10)
├─ Day 6     : 撮影UI完成
├─ Day 7     : 確認・撮り直し機能
├─ Day 8     : 動画生成機能
├─ Day 9     : E2Eテスト・バグ修正
└─ Day 10    : UI/UXブラッシュアップ

Week 3: Release (Day 11-12)
├─ Day 11    : デプロイ準備
└─ Day 12    : 本番リリース・検証
```

### マイルストーン

| 日付 | マイルストーン | 成果物 |
|------|-------------|--------|
| **Day 3** | 📊 **解析エンジン完成** | 動画→フレーム→ユニークポーズ検出が動作 |
| **Day 6** | 📸 **撮影機能完成** | カメラ起動→ポーズマッチング→自動撮影が動作 |
| **Day 8** | 🎬 **MVP完成** | アップロード→撮影→動画生成の全フローが動作 |
| **Day 12** | 🚀 **本番リリース** | https://danceframe.app で公開 |

---

## 🛠️ 技術スタック（最新版）

### Frontend
```
Next.js 16.0         - Reactフレームワーク（Turbopack）
React 19.2           - UIライブラリ（React Compiler）
TypeScript 5.3       - 型安全性
MediaPipe Tasks-Vision 0.10.15 - AI骨格推定（最新API）
Zustand 5.0.8        - 状態管理
Tailwind CSS 3.4     - スタイリング
Framer Motion 11.0   - アニメーション
```

### Backend
```
FastAPI 0.115        - Webフレームワーク
Celery 5.4           - バックグラウンドタスク
Redis 7.2            - メッセージブローカー
Python 3.11          - 実行環境
FFmpeg 6.1           - 動画処理
MediaPipe 0.10.14    - AI骨格推定（Python）
imagehash 4.3.1      - 知覚ハッシュ
```

### Infrastructure
```
Vercel               - Frontend ホスティング
Railway              - Backend ホスティング
GitHub Actions       - CI/CD
Docker               - ローカル開発環境
```

---

## 📋 初日（Day 1）のタスク

### Claude の初日タスク（4時間）

**午前（2時間）:**
- [x] キックオフドキュメント確認
- [ ] リポジトリクローン
- [ ] Backend プロジェクト構造作成
  ```bash
  mkdir -p packages/backend/app/{routers,services,tasks,models}
  touch packages/backend/app/{__init__.py,main.py}
  ```
- [ ] requirements.txt 作成
- [ ] Docker Compose 作成
- [ ] Redis セットアップ確認

**午後（2時間）:**
- [ ] FastAPI Hello World 実装
- [ ] Celery Worker セットアップ
- [ ] `/health` エンドポイント作成
- [ ] Swagger UI 確認（http://localhost:8000/docs）
- [ ] Cursor へ API仕様の初期版共有

**完了基準:**
✅ http://localhost:8000/docs にアクセスできる
✅ Celery Worker が起動する
✅ Redis に接続できる

---

### Cursor の初日タスク（4時間）

**午前（2時間）:**
- [x] キックオフドキュメント確認
- [ ] リポジトリクローン
- [ ] Next.js 16 プロジェクト作成
  ```bash
  cd packages/frontend
  npx create-next-app@latest . --typescript --tailwind --app
  ```
- [ ] 依存関係インストール
  ```bash
  npm install @mediapipe/tasks-vision@0.10.15 zustand@5.0.8 axios framer-motion
  ```
- [ ] プロジェクト構造作成

**午後（2時間）:**
- [ ] Tailwind CSS 設定
- [ ] 基本レイアウトコンポーネント作成
  - `Header.tsx`
  - `Footer.tsx`
  - `Layout.tsx`
- [ ] トップページ（`/page.tsx`）仮実装
- [ ] Claude へ UI設計の初期版共有

**完了基準:**
✅ http://localhost:3000 にアクセスできる
✅ Tailwind CSS が適用される
✅ レイアウトが表示される

---

## 📞 コミュニケーションルール

### デイリースタンドアップ

**時間**: 毎朝 9:00（非同期 - GitHub Issue）

**フォーマット:**
```markdown
## Daily Standup - 2025-11-XX

### Claude
**Yesterday:** [昨日やったこと]
**Today:** [今日やること]
**Blockers:** [困っていること]

### Cursor
**Yesterday:** [昨日やったこと]
**Today:** [今日やること]
**Blockers:** [困っていること]
```

**ルール:**
- 簡潔に（各項目2-3行）
- ブロッカーは具体的に
- 9:30までに投稿

---

### コードレビュー

**PR作成タイミング:**
- 機能が動作する単位
- 1日1回以上

**レビュー観点:**
- 動作確認
- コード品質
- テストカバレッジ
- ドキュメント更新

**レビュー時間:**
- 6時間以内にレビュー完了
- 緊急時はSlackで通知

---

### 質問・相談

**GitHub Issue:**
- 仕様確認
- アーキテクチャ議論
- バグ報告

**Slack/Discord:**
- 緊急の質問
- 即座の判断が必要な事項
- 雑談

---

## 🎯 成功基準

### MVP（最小機能製品）の定義

**必須機能:**
1. ✅ 動画アップロード（MP4, GIF）
2. ✅ 自動フレーム解析（ユニークポーズ検出）
3. ✅ カメラでポーズ撮影（自動シャッター）
4. ✅ 撮影結果確認・撮り直し
5. ✅ 動画生成・ダウンロード

**品質基準:**
- テストカバレッジ: Backend 80%+, Frontend 70%+
- パフォーマンス: 10秒動画を30秒以内で処理
- セキュリティ: ファイル検証、Rate Limiting
- UX: Lighthouse スコア 90点以上

---

### リリース基準

**技術要件:**
- [ ] 全機能が本番環境で動作
- [ ] E2Eテスト全パス
- [ ] セキュリティテストパス
- [ ] パフォーマンステストパス
- [ ] クロスブラウザ動作確認

**ドキュメント:**
- [ ] README.md 完成
- [ ] API仕様書 完成
- [ ] ユーザーガイド（簡易版）

**運用準備:**
- [ ] モニタリング設定
- [ ] エラーログ収集
- [ ] バックアップ手順確認

---

## 📚 参考資料

### 必読ドキュメント（優先度順）

1. **DIVISION_OF_LABOR.md** - 役割分担の詳細
2. **TEAM_WORKFLOW.md** - 開発フロー
3. **SPECIFICATION_V2.md** - 技術仕様書
4. **ARCHITECTURE.md** - システム設計
5. **SETUP.md** - 環境構築手順

### 外部リソース

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Celery Documentation](https://docs.celeryproject.org/)

---

## 🎉 期待される成果

### 技術的成果

- ✅ 最新技術スタックの実践経験
  - Next.js 16 (Turbopack)
  - React 19.2 (React Compiler)
  - MediaPipe Tasks Vision (最新API)
- ✅ AI/ML統合の実装経験
- ✅ 動画処理パイプラインの構築経験
- ✅ マイクロサービス的アーキテクチャの経験

### プロダクト成果

- ✅ 実用的なWebアプリケーション
- ✅ ユニークな「踊ってみた」体験
- ✅ 高品質なコードベース
- ✅ 包括的なドキュメント

### チーム成果

- ✅ 効率的な2人開発フローの確立
- ✅ 非同期コミュニケーションの実践
- ✅ コードレビュー文化の醸成

---

## 💪 行動指針

### Do's（やるべきこと）

✅ **コミュニケーションファースト**
- 分からないことは即座に質問
- 進捗を定期的に共有
- ブロッカーは早期に報告

✅ **品質重視**
- テストを書く
- レビューを丁寧に
- ドキュメントを更新

✅ **継続的改善**
- レトロスペクティブで振り返り
- プロセスを改善
- 学びを共有

---

### Don'ts（避けるべきこと）

❌ **サイレントワーク**
- 進捗を共有しない
- 質問しない
- レビュー依頼を出さない

❌ **スコープクリープ**
- MVP範囲外の機能追加
- 過度な最適化
- 完璧主義

❌ **技術的負債の放置**
- TODOコメントの放置
- テストなしのコミット
- ドキュメント未更新

---

## 🎊 キックオフメッセージ

### Claude より

```
みなさん、こんにちは！Claude です。

DanceFrame プロジェクトのキックオフ、おめでとうございます！🎉

このプロジェクトは、最新のWeb技術とAIを組み合わせた
エキサイティングな挑戦です。

Cursor さんと協力して、ユーザーに楽しい体験を提供できる
プロダクトを作り上げましょう。

私は主にバックエンドを担当しますが、
技術的な質問や相談はいつでも大歓迎です。

一緒に素晴らしいものを作りましょう！💪

Let's build something amazing together!
```

---

### Cursor より

```
Hi! Cursor です。

一緒に働けることを楽しみにしています！

フロントエンドを中心に、ユーザーが直感的に使える
UIを実装していきます。

技術的なことでも、UIのことでも、
気軽に相談してください。

12日間、全力で取り組みましょう！🚀
```

---

## 🚀 Let's Get Started!

**初日のゴール:**
- ✅ 開発環境が整っている
- ✅ Hello World が動作している
- ✅ チーム内コミュニケーションが確立している

**さぁ、始めましょう！**

```bash
# Claude
cd dance-frame/packages/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Cursor
cd dance-frame/packages/frontend
npm install
npm run dev
```

**Happy Coding! 🎨💻🎬**

---

**Document Version**: 1.0
**Date**: 2025-11-16
**Team**: Claude (Lead) + Cursor (Developer)
**Project**: DanceFrame
