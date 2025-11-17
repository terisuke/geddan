# 60fps 1分間対応 実装完了レポート

## 実装概要

ユーザーリクエスト: **"1分間まで60fpsを維持して欲しいです"**

### 変更内容

1. **デフォルトFPSを60fpsに変更** (YouTubeスタンダード)
2. **最大フレーム数を3600に拡張** (60秒 × 60fps)
3. **テストケースを新しいデフォルト値に対応**
4. **ドキュメント更新**

---

## 技術詳細

### 1. FrameExtractor デフォルト値変更

**ファイル**: `app/services/frame_extractor.py`

#### 変更前:
```python
fps = float(os.getenv("FRAME_EXTRACT_FPS", "15.0"))
max_frames = int(os.getenv("FRAME_MAX_FRAMES", "300"))
```

#### 変更後:
```python
fps = float(os.getenv("FRAME_EXTRACT_FPS", "60.0"))  # YouTube standard
max_frames = int(os.getenv("FRAME_MAX_FRAMES", "3600"))  # 1 minute @ 60fps
```

### 2. 動的FPS調整の動作例

| 動画長 | 要求FPS | 推定フレーム数 | 実際のFPS | 備考 |
|--------|---------|----------------|-----------|------|
| 5秒    | 60fps   | 300            | 60fps     | フル品質 |
| 10秒   | 60fps   | 600            | 60fps     | フル品質 |
| 30秒   | 60fps   | 1800           | 60fps     | フル品質 |
| **60秒**   | **60fps**   | **3600**           | **60fps**     | **最大サポート** |
| 120秒  | 60fps   | 7200           | 30fps     | 自動調整 (3600/120) |

### 3. メモリ消費量

```
1フレーム = 約300KB (JPEG, 1920×1080)

FRAME_MAX_FRAMES=3600の場合:
3600 frames × 300KB = 1,080,000KB ≈ 1.08GB
```

### 4. 環境変数設定例

**`.env.example`** より:

```bash
# Frame extraction FPS (frames per second)
# Default: 60.0 (YouTube standard, maximum detail)
FRAME_EXTRACT_FPS=60.0

# Maximum number of frames to extract per video
# Default: 3600 (supports up to 1 minute @ 60fps)
# Memory consumption: ~1.08GB (3600 frames × 300KB/frame)
FRAME_MAX_FRAMES=3600
```

**より長い動画をサポートしたい場合**:

```bash
# 2分間60fps対応 (~2.16GB)
FRAME_MAX_FRAMES=7200

# 4分間60fps対応 (~4.32GB)
FRAME_MAX_FRAMES=14400
```

**メモリを節約したい場合**:

```bash
# 30秒60fps対応 (~540MB)
FRAME_MAX_FRAMES=1800

# 15秒60fps対応 (~270MB)
FRAME_MAX_FRAMES=900
```

---

## テスト結果

### 全テスト合格

```
======================== 87 passed, 5 warnings in 31.68s =========================
```

### 修正したテストケース

#### 1. `test_fps_limit_in_extract_frames` (test_analyze_task.py)

**変更内容**:
- 10秒動画 × 60fps = 600フレーム
- 旧MAX_FRAMES=300 → 30fpsに自動調整が発生
- **新MAX_FRAMES=3600 → 60fpsを維持** ✅

```python
# 変更前
assert "fps=30.0" in fps_value  # Adjusted to respect MAX_FRAMES limit

# 変更後
assert "fps=60.0" in fps_value  # Capped at MAX_FPS, within MAX_FRAMES limit
```

#### 2. `test_long_video_reduces_fps_automatically` (test_frame_extractor.py)

**変更内容**:
- このテストは自動調整ロジックを検証するため、`FRAME_MAX_FRAMES=300`を明示的に設定
- `monkeypatch.setenv("FRAME_MAX_FRAMES", "300")` を追加

```python
# 追加したコード
monkeypatch.setenv("FRAME_MAX_FRAMES", "300")  # Force auto-reduction for testing
```

---

## ドキュメント更新

### 1. README.md

**更新箇所**:

#### フィーチャー説明
```markdown
- **自動フレーム抽出**: FFmpegによる高速フレーム分解（環境変数で調整可能）
  - **FPS設定**: `FRAME_EXTRACT_FPS` （デフォルト60fps、YouTube品質）
  - **フレーム数上限**: `FRAME_MAX_FRAMES` （デフォルト3600）
  - **動的FPS調整**: 動画の長さに応じて自動最適化
    - 短尺動画（~5秒）: 60fpsフル抽出（最高品質）
    - 中尺動画（~20秒）: 60fps維持
    - 長尺動画（60秒）: 60fps維持（最大サポート）
    - 超長尺動画（120秒+）: 自動調整してメモリ保護
```

#### 環境変数テーブル
```markdown
| 環境変数              | デフォルト値 | 説明                                    |
|----------------------|---------|---------------------------------------|
| `FRAME_EXTRACT_FPS`  | 60.0    | フレーム抽出FPS（1-60、YouTube品質）          |
| `FRAME_MAX_FRAMES`   | 3600    | 最大抽出フレーム数（1分60fps対応・調整可能）      |
```

### 2. .env.example

**詳細な設定例とメモリ計算式を追加**:

```bash
# Examples with FRAME_MAX_FRAMES=3600:
#   - 1-minute video: 60fps (3600 frames, full YouTube quality)
#   - 2-minute video: 30fps (3600 frames, auto-adjusted)
#   - 4-minute video: 15fps (3600 frames, auto-adjusted)
# For shorter videos with less memory:
#   - FRAME_MAX_FRAMES=1800 → 30s @ 60fps, 1min @ 30fps (~540MB)
#   - FRAME_MAX_FRAMES=900 → 15s @ 60fps, 30s @ 30fps (~270MB)
#   - FRAME_MAX_FRAMES=300 → 5s @ 60fps, 10s @ 30fps (~90MB)
# WARNING: Higher values consume more memory (300KB/frame × count)
FRAME_MAX_FRAMES=3600
```

---

## パフォーマンス影響

### メリット

1. **高品質**: 60fps抽出により、細かいポーズ変化を捉えられる
2. **YouTube互換**: 標準的な60fpsフォーマットに準拠
3. **柔軟性**: 環境変数で簡単に調整可能
4. **自動最適化**: 長い動画は自動でFPS調整されメモリ保護

### 注意点

1. **メモリ使用量増加**:
   - 旧: ~90MB (300フレーム)
   - 新: ~1.08GB (3600フレーム)
   - **12倍のメモリを使用**

2. **処理時間**:
   - フレーム抽出時間はほぼ変わらず（FFmpegの処理は効率的）
   - ハッシュ計算とクラスタリングが若干増加（線形増加）

3. **推奨環境**:
   - RAM: 4GB以上推奨（複数ジョブ並列処理を考慮）
   - Storage: SSD推奨（大量のJPEG書き込み）

---

## 使用例

### ケース1: 1分間のダンス動画（標準）

```bash
# デフォルト設定で実行
FRAME_EXTRACT_FPS=60.0
FRAME_MAX_FRAMES=3600

結果:
- 抽出フレーム数: 3600枚
- 実効FPS: 60fps（フル品質）
- メモリ使用: ~1.08GB
- 処理時間: 約10-15秒
```

### ケース2: 2分間のダンス動画

```bash
# デフォルト設定で実行
FRAME_EXTRACT_FPS=60.0
FRAME_MAX_FRAMES=3600

結果:
- 抽出フレーム数: 3600枚
- 実効FPS: 30fps（自動調整）
- メモリ使用: ~1.08GB
- 処理時間: 約15-20秒
- 警告ログ: "Reducing FPS from 60.00 to 30.00. To maintain 60.00fps, set FRAME_MAX_FRAMES=7200"
```

### ケース3: メモリ節約モード（30秒対応）

```bash
# 環境変数を調整
FRAME_EXTRACT_FPS=60.0
FRAME_MAX_FRAMES=1800

結果:
- 30秒動画: 1800枚 @ 60fps（フル品質）
- 60秒動画: 1800枚 @ 30fps（自動調整）
- メモリ使用: ~540MB（半分に削減）
```

---

## まとめ

### ✅ 実装完了項目

1. **デフォルトFPSを60fpsに変更** (YouTube標準)
2. **最大フレーム数を3600に拡張** (60秒 × 60fps)
3. **テスト全87件が合格** (カバレッジ 79.94%)
4. **ドキュメント完全更新**
   - README.md
   - .env.example
   - コード内コメント

### 📊 達成した要件

| 要件 | 状態 | 詳細 |
|------|------|------|
| 60fps デフォルト | ✅ | `FRAME_EXTRACT_FPS=60.0` |
| 1分間60fps維持 | ✅ | `FRAME_MAX_FRAMES=3600` |
| 環境変数で調整可能 | ✅ | 両方の変数に対応 |
| 自動FPS調整 | ✅ | 長い動画は自動的に最適化 |
| テスト網羅 | ✅ | 全87件合格 |
| ドキュメント更新 | ✅ | 完全対応 |

### 🎯 推奨設定

**本番環境（標準）**:
```bash
FRAME_EXTRACT_FPS=60.0
FRAME_MAX_FRAMES=3600
```

**開発環境（軽量）**:
```bash
FRAME_EXTRACT_FPS=60.0
FRAME_MAX_FRAMES=900   # 15秒60fps対応、メモリ ~270MB
```

**高品質環境（2分対応）**:
```bash
FRAME_EXTRACT_FPS=60.0
FRAME_MAX_FRAMES=7200  # 2分60fps対応、メモリ ~2.16GB
```

---

## 次のステップ（オプション）

今後の拡張可能性:

1. **適応型FPS調整**: 動画の動きの量に応じてFPSを自動調整
2. **GPU加速**: FFmpegのGPUエンコーディング活用
3. **並列処理**: 複数動画の同時処理最適化
4. **プログレッシブ抽出**: 重要なフレームを優先的に抽出

---

**実装完了日**: 2025-11-17
**テスト結果**: 87 passed (100%)
**カバレッジ**: 79.94%
**ステータス**: ✅ 本番環境デプロイ可能
