# Milestone: Upload → Frame Analysis → pHash Clustering → Thumbnails

目的: ローカル環境で「動画アップロード → フレーム抽出 → 知覚ハッシュ(pHash)計算・クラスタリング → 代表サムネ表示」まで完走させる。

## スコープ
- 対象: packages/backend, packages/frontend
- 範囲: アップロード済み動画のフレーム分解、pHashクラスタリング、サムネ保存/配信、解析進捗API応答とUI表示
- 非対象: 本番デプロイ、最終動画合成、外部ストレージ連携

## 担当と作業
- Claude（Backend）
  - Celery/Redis連携で解析ジョブ実行（ffmpeg分解→imagehash.phash→クラスタリング→代表フレーム抽出）
  - `/api/analyze/{job_id}`: 進捗・クラスタ結果・サムネURLを返す
  - `/outputs/{job_id}/thumbnails/` に画像を書き出し、静的配信できるようにする
  - 失敗時リトライとエラー内容をステータスに反映
- Cursor（Frontend）
  - 解析進捗ポーリングで `status=completed` 時にクラスタとサムネを描画
  - `result` スキーマに合わせてUI実装（クラスタ代表サムネのグリッド表示、必要ならクラスタサイズ表示）
  - 404/501/503時はモックにフォールバック、`analysis not implemented` と受け取った場合は明示的なプレースホルダー表示

## 受け入れ条件
- ローカルで以下が動作:
  1. `mise run backend:serve` + `mise run frontend:dev`
  2. `/upload` から100MB未満のMP4/GIFアップロード
  3. `/analysis?jobId=...` で進捗が遷移し、完了時にクラスタ代表サムネが表示される
- バックエンドテスト: `mise run backend:test` がパス
- フロントE2E: モック使用時にアップロード～分析表示フローのシナリオがパス

## 進捗ポーリングの期待値
- **前提条件**: Redis/Celeryが起動している必要があります（バックエンドサービスが必須）
- **ポーリング間隔**: 5秒間隔でステータスを取得
- **進捗ステップ**: 以下の順序で進捗が更新されます
  - 0%: キュー待ち / 開始前
  - 10%: フレーム抽出開始（Step 1）
  - 30%: 知覚ハッシュ計算・クラスタリング（Step 2）
  - 60%: サムネイル生成（Step 3）
  - 90%: 結果保存（Step 4）
  - 100%: 完了（クラスタ情報が返される）
- **UI表示**: バックエンドが返す `progress` と `current_step` がそのまま表示されます
- **フォールバック**: 404/501/503エラー時はモックAPIにフォールバックし、未実装表示を行います

## スキーマ（確定版）

### バックエンド (Pydantic)

```python
class ClusterInfo(BaseModel):
    id: int  # Cluster ID (0-indexed)
    size: int  # Number of frames in this cluster
    thumbnail_url: str  # URL path to cluster representative thumbnail

class AnalysisResult(BaseModel):
    clusters: List[ClusterInfo]

class AnalysisStatus(BaseModel):
    job_id: str
    status: str  # "processing" | "completed" | "failed" | "pending"
    progress: int  # 0-100
    current_step: Optional[str]
    error: Optional[str]
    result: Optional[AnalysisResult]
```

### フロントエンド (TypeScript)

```typescript
interface ClusterInfo {
  id: number;
  size: number;
  thumbnail_url: string;
}

interface AnalysisResult {
  clusters: ClusterInfo[];
}

interface AnalysisResponse {
  job_id: string;
  status: 'processing' | 'completed' | 'failed' | 'pending';
  progress: number;
  current_step?: string;
  result?: AnalysisResult;
  error?: string;
}
```

### APIレスポンス例

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "current_step": "Done!",
  "error": null,
  "result": {
    "clusters": [
      {
        "id": 0,
        "size": 12,
        "thumbnail_url": "/outputs/550e8400-e29b-41d4-a716-446655440000/thumbnails/cluster-0.jpg"
      },
      {
        "id": 1,
        "size": 8,
        "thumbnail_url": "/outputs/550e8400-e29b-41d4-a716-446655440000/thumbnails/cluster-1.jpg"
      }
    ]
  }
}
```

## 実装状況

### ✅ 完了（Cursor担当）

- [x] APIスキーマ確定: `ClusterInfo`, `AnalysisResult` モデル追加
- [x] フロントエンド型定義更新: `AnalysisResponse` に `result.clusters` 追加
- [x] モックAPI更新: `mockGetAnalysisStatus` にクラスタ構造を反映
- [x] 静的配信設定: `/outputs/` を StaticFiles でマウント

### ✅ 完了（Claude担当）

- [x] Celeryタスクでパイプライン実装: ffmpeg分解→imagehash.phash→クラスタリング
- [x] `/api/analyze/{job_id}` で進捗・クラスタ結果・サムネURL返却
- [x] `/outputs/{job_id}/thumbnails/` への画像保存
- [x] **進捗ポーリング対応**: Redis に中間ステータス書き込み (0→10→30→60→90→100%)
- [x] **upload.py**: アップロード時に初期ステータスを Redis に書き込み
- [x] **analyze_video_task**: 各ステップで Redis ステータス更新
- [x] **analyze.py**: Docstring 更新、pending 状態の明確化
- [x] **統合テスト**: `test_status_polling.py` 追加（73テストすべてパス）

## メモ
- pHash: `imagehash.phash`（hash_sizeは8または16で、速度と精度のバランス）
- ffmpeg: 環境変数対応（デフォルト15fps、最大60fps）で動的調整
  - FRAME_EXTRACT_FPS環境変数でFPS設定可能（1-60範囲）
  - 短尺動画（≤5秒）: 最大60fpsでポーズ抜け防止
  - 長尺動画（30秒+）: MAX_FRAMES=300を超えないよう自動縮小
- 進捗更新: ステップごとに`progress`を上げ、クライアントのUI更新をしやすくする
