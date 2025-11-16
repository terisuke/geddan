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

### 🚧 実装中（Claude担当）

- [ ] Celeryタスクでパイプライン実装: ffmpeg分解→imagehash.phash→クラスタリング
- [ ] `/api/analyze/{job_id}` で進捗・クラスタ結果・サムネURL返却
- [ ] `/outputs/{job_id}/thumbnails/` への画像保存
- [ ] エラーハンドリングと進捗更新ロジック

## メモ
- pHash: `imagehash.phash`（hash_sizeは8または16で、速度と精度のバランス）
- ffmpeg: 既存の依存に基づき、1fpsなど適度に間引いて処理時間を抑制
- 進捗更新: ステップごとに`progress`を上げ、クライアントのUI更新をしやすくする
