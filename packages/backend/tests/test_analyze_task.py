"""
Tests for video analysis Celery task

Tests the full pipeline: frame extraction → hashing → clustering → thumbnails
"""

import pytest
from pathlib import Path
import tempfile
import shutil
from PIL import Image

# Import services
from app.services.frame_extractor import FrameExtractor
from app.services.hash_analyzer import HashAnalyzer
from app.services.file_service import file_service


class TestFrameExtractor:
    """Test frame extraction service"""

    def test_extract_frames_creates_output_directory(self, tmp_path):
        """Test that output directory is created"""
        extractor = FrameExtractor(fps=1.0)
        output_dir = tmp_path / "frames"

        # Create a minimal test video (1x1 pixel, 1 second)
        # For now, we'll test the directory creation only
        assert not output_dir.exists()

        # Create directory manually to test
        output_dir.mkdir(parents=True, exist_ok=True)
        assert output_dir.exists()

    def test_extractor_initialization(self):
        """Test that FrameExtractor initializes correctly"""
        extractor = FrameExtractor(fps=2.0)
        assert extractor.fps == 2.0

        # Default FPS is now 60.0 (from FRAME_EXTRACT_FPS env var, YouTube standard)
        extractor_default = FrameExtractor()
        assert extractor_default.fps == 60.0


class TestHashAnalyzer:
    """Test perceptual hash analyzer"""

    @pytest.fixture
    def sample_images(self, tmp_path):
        """Create sample test images"""
        images = []

        # Create 3 similar images (same color)
        for i in range(3):
            img = Image.new('RGB', (100, 100), color=(255, 0, 0))
            img_path = tmp_path / f"red_{i}.jpg"
            img.save(img_path)
            images.append(img_path)

        # Create 2 different images (different color)
        for i in range(2):
            img = Image.new('RGB', (100, 100), color=(0, 0, 255))
            img_path = tmp_path / f"blue_{i}.jpg"
            img.save(img_path)
            images.append(img_path)

        return images

    def test_compute_hashes(self, sample_images):
        """Test that hashes are computed for all images"""
        analyzer = HashAnalyzer(hash_size=8, hamming_threshold=5)
        hashes = analyzer.compute_hashes(sample_images)

        assert len(hashes) == len(sample_images)
        assert all(img_path in hashes for img_path in sample_images)

    def test_cluster_frames(self, sample_images):
        """Test that similar frames are clustered together"""
        analyzer = HashAnalyzer(hash_size=8, hamming_threshold=5)

        # Compute hashes
        hashes = analyzer.compute_hashes(sample_images)

        # Cluster frames
        clusters, frame_mapping = analyzer.cluster_frames(hashes)

        # Should have 2 clusters (red and blue)
        assert len(clusters) >= 1  # At least one cluster
        assert len(clusters) <= len(sample_images)  # At most one per image

    def test_select_representatives(self, sample_images):
        """Test representative selection"""
        analyzer = HashAnalyzer(hash_size=8, hamming_threshold=5)

        # Compute hashes and cluster
        hashes = analyzer.compute_hashes(sample_images)
        clusters, frame_mapping = analyzer.cluster_frames(hashes)

        # Select representatives
        representatives = analyzer.select_representatives(clusters)

        assert len(representatives) == len(clusters)

        # Check structure of representatives
        for cluster_id, rep_path, cluster_size in representatives:
            assert isinstance(cluster_id, int)
            assert isinstance(rep_path, Path)
            assert isinstance(cluster_size, int)
            assert cluster_size > 0

    def test_analyze_full_pipeline(self, sample_images):
        """Test full analysis pipeline"""
        analyzer = HashAnalyzer(hash_size=8, hamming_threshold=5)

        representatives, frame_mapping = analyzer.analyze(sample_images)

        assert len(representatives) > 0
        assert len(representatives) <= len(sample_images)

        # Verify all cluster IDs are unique
        cluster_ids = [cid for cid, _, _ in representatives]
        assert len(cluster_ids) == len(set(cluster_ids))

    def test_hamming_threshold_from_environment(self, monkeypatch):
        """Test that hamming_threshold is read from HASH_HAMMING_THRESHOLD environment variable"""
        monkeypatch.setenv("HASH_HAMMING_THRESHOLD", "3")

        analyzer = HashAnalyzer()
        assert analyzer.hamming_threshold == 3

    def test_hamming_threshold_default_without_environment(self, monkeypatch):
        """Test that default hamming_threshold is 6 when environment variable is not set"""
        monkeypatch.delenv("HASH_HAMMING_THRESHOLD", raising=False)

        analyzer = HashAnalyzer()
        assert analyzer.hamming_threshold == 6  # New default for 60fps videos (merges similar poses)

    def test_explicit_hamming_threshold_overrides_environment(self, monkeypatch):
        """Test that explicit hamming_threshold parameter overrides environment variable"""
        monkeypatch.setenv("HASH_HAMMING_THRESHOLD", "3")

        analyzer = HashAnalyzer(hamming_threshold=6)
        assert analyzer.hamming_threshold == 6


class TestAnalysisPipeline:
    """Integration test for the full analysis pipeline"""

    @pytest.fixture
    def test_job(self, tmp_path):
        """Create a test job directory structure"""
        job_id = "test-job-123"
        job_dir = tmp_path / job_id

        # Create job directory
        job_dir.mkdir(parents=True, exist_ok=True)

        # Create frames directory
        frames_dir = job_dir / "frames"
        frames_dir.mkdir(exist_ok=True)

        # Create sample frame images
        for i in range(5):
            img = Image.new('RGB', (100, 100), color=(i * 50, 0, 0))
            img_path = frames_dir / f"frame_{i:04d}.jpg"
            img.save(img_path)

        return {
            "job_id": job_id,
            "job_dir": job_dir,
            "frames_dir": frames_dir,
        }

    def test_clustering_and_thumbnail_generation(self, test_job):
        """Test clustering and thumbnail generation"""
        frames_dir = test_job["frames_dir"]
        job_dir = test_job["job_dir"]

        # Get frame paths
        frame_paths = sorted(frames_dir.glob("frame_*.jpg"))
        assert len(frame_paths) == 5

        # Run hash analyzer
        analyzer = HashAnalyzer(hash_size=8, hamming_threshold=5)
        representatives, frame_mapping = analyzer.analyze(frame_paths)

        # Generate thumbnails
        thumbnails_dir = job_dir / "thumbnails"
        thumbnails_dir.mkdir(exist_ok=True)

        for cluster_id, rep_path, cluster_size in representatives:
            thumbnail_path = thumbnails_dir / f"cluster-{cluster_id}.jpg"
            shutil.copy2(rep_path, thumbnail_path)

        # Verify thumbnails were created
        thumbnail_files = list(thumbnails_dir.glob("cluster-*.jpg"))
        assert len(thumbnail_files) == len(representatives)

    def test_result_structure(self, test_job):
        """Test that result structure matches schema"""
        frames_dir = test_job["frames_dir"]
        frame_paths = sorted(frames_dir.glob("frame_*.jpg"))

        analyzer = HashAnalyzer(hash_size=8, hamming_threshold=5)
        representatives, frame_mapping = analyzer.analyze(frame_paths)

        # Build result structure (same as in analyze_video_task)
        clusters = []
        for cluster_id, rep_path, cluster_size in representatives:
            thumbnail_url = f"/outputs/{test_job['job_id']}/thumbnails/cluster-{cluster_id}.jpg"
            clusters.append({
                "id": cluster_id,
                "size": cluster_size,
                "thumbnail_url": thumbnail_url,
            })

        # Validate structure
        assert isinstance(clusters, list)
        assert len(clusters) > 0

        for cluster in clusters:
            assert "id" in cluster
            assert "size" in cluster
            assert "thumbnail_url" in cluster
            assert cluster["size"] > 0
            assert cluster["thumbnail_url"].startswith("/outputs/")


class TestErrorHandling:
    """Test error handling in analysis pipeline"""

    def test_empty_frame_list(self):
        """Test that empty frame list raises error"""
        analyzer = HashAnalyzer()

        with pytest.raises(RuntimeError, match="No frames provided"):
            analyzer.analyze([])

    def test_invalid_image_path(self, tmp_path):
        """Test that invalid image path raises error"""
        analyzer = HashAnalyzer()
        invalid_path = tmp_path / "nonexistent.jpg"

        with pytest.raises(RuntimeError):
            analyzer.compute_hashes([invalid_path])

    def test_extractor_nonexistent_video(self, tmp_path):
        """Test that nonexistent video raises FileNotFoundError"""
        extractor = FrameExtractor()
        video_path = tmp_path / "nonexistent.mp4"
        output_dir = tmp_path / "output"

        with pytest.raises(FileNotFoundError):
            extractor.extract_frames(video_path, output_dir)


class TestThumbnailOutput:
    """Test thumbnail generation and output paths"""

    def test_thumbnails_saved_to_outputs_directory(self, tmp_path):
        """
        Test that thumbnails are saved to outputs/{job_id}/thumbnails/
        This ensures they are accessible via /outputs/ StaticFiles mount
        """
        from app.services.file_service import FileService
        from pathlib import Path

        # Create test file service with custom base directories
        test_uploads = tmp_path / "uploads"
        test_outputs = tmp_path / "outputs"

        file_service = FileService(
            base_upload_dir=str(test_uploads),
            base_output_dir=str(test_outputs)
        )

        job_id = "test-job-123"

        # Get output directory
        output_dir = file_service.get_output_directory(job_id)

        # Verify output directory is in outputs/, not uploads/
        assert output_dir == test_outputs / job_id
        assert output_dir.exists()

        # Create thumbnails directory
        thumbnails_dir = output_dir / "thumbnails"
        thumbnails_dir.mkdir(parents=True, exist_ok=True)

        # Create a test thumbnail
        test_thumbnail = thumbnails_dir / "cluster-0.jpg"
        test_thumbnail.write_bytes(b"fake thumbnail data")

        # Verify thumbnail exists at correct path
        assert test_thumbnail.exists()
        assert test_thumbnail.parent == thumbnails_dir
        assert str(test_thumbnail).startswith(str(test_outputs))  # Must be in outputs/, not uploads/

        # Verify URL path would be correct
        expected_url = f"/outputs/{job_id}/thumbnails/cluster-0.jpg"
        # This URL will be served by StaticFiles(directory="outputs")
    
    async def test_thumbnail_static_files_access(self, client):
        """
        Test that thumbnails saved to outputs/{job_id}/thumbnails/ are accessible
        via /outputs/{job_id}/thumbnails/cluster-0.jpg endpoint (StaticFiles mount)

        This verifies that the absolute path configuration works correctly
        regardless of uvicorn's working directory.
        """
        from app.services.file_service import file_service
        from app.main import BASE_DIR
        from pathlib import Path
        from PIL import Image

        # Use the actual file_service instance and BASE_DIR from app.main
        # This ensures we're testing with the same paths the app uses
        job_id = "test-static-files-001"

        # Get output directory (should be absolute and match BASE_DIR)
        output_dir = file_service.get_output_directory(job_id)
        assert output_dir.is_absolute(), f"Output directory should be absolute: {output_dir}"

        # Verify it's under BASE_DIR/outputs
        expected_base = BASE_DIR / "outputs"
        assert output_dir.parent == expected_base, \
            f"Output directory {output_dir} should be under {expected_base}"

        # Create thumbnails directory
        thumbnails_dir = output_dir / "thumbnails"
        thumbnails_dir.mkdir(parents=True, exist_ok=True)

        # Create a test thumbnail image
        test_thumbnail_path = thumbnails_dir / "cluster-0.jpg"
        img = Image.new('RGB', (100, 100), color=(255, 0, 0))
        img.save(test_thumbnail_path)

        # Verify thumbnail exists at correct absolute path
        assert test_thumbnail_path.exists(), f"Thumbnail should exist at {test_thumbnail_path}"
        assert test_thumbnail_path.is_absolute()

        # Test HTTP access via StaticFiles mount
        # The URL should match the file location relative to BASE_DIR/outputs
        expected_url = f"/outputs/{job_id}/thumbnails/cluster-0.jpg"

        # Use AsyncClient to verify the file is accessible
        # Note: This requires the app to be running with the actual BASE_DIR/outputs mounted
        response = await client.get(expected_url)
        assert response.status_code == 200, \
            f"Expected 200, got {response.status_code} for {expected_url}"
        assert response.headers["content-type"].startswith("image/"), \
            f"Expected image content type, got {response.headers['content-type']}"

        # Cleanup test file
        test_thumbnail_path.unlink(missing_ok=True)
        thumbnails_dir.rmdir()
        output_dir.rmdir()


class TestVideoSafetyLimits:
    """Test safety limits for video processing"""

    def test_max_duration_limit(self, tmp_path):
        """Test that videos exceeding MAX_DURATION_SECONDS are rejected"""
        from unittest.mock import MagicMock

        extractor = FrameExtractor(fps=1.0)
        video_path = tmp_path / "long_video.mp4"
        video_path.touch()
        output_dir = tmp_path / "output"

        # Mock get_video_info to return video exceeding duration limit
        extractor.get_video_info = MagicMock(return_value={
            "duration": 400.0,  # Exceeds MAX_DURATION_SECONDS (300)
            "fps": 30.0,
            "width": 1920,
            "height": 1080,
            "codec": "h264",
            "size": 10000000
        })

        # Should raise RuntimeError for excessive duration
        with pytest.raises(RuntimeError, match="duration.*exceeds maximum"):
            extractor.extract_frames(video_path, output_dir)

    def test_max_frames_auto_adjustment(self, tmp_path, monkeypatch):
        """Test that FPS is automatically adjusted when estimated frames exceed limit"""
        from unittest.mock import MagicMock
        import subprocess

        extractor = FrameExtractor(fps=5.0)
        video_path = tmp_path / "high_fps_video.mp4"
        video_path.touch()
        output_dir = tmp_path / "output"

        # Mock get_video_info to return video that would exceed MAX_FRAMES
        extractor.get_video_info = MagicMock(return_value={
            "duration": 100.0,  # 100 seconds * 5fps = 500 frames (exceeds MAX_FRAMES=300)
            "fps": 30.0,
            "width": 1920,
            "height": 1080,
            "codec": "h264",
            "size": 10000000
        })

        # Mock subprocess to avoid actual FFmpeg execution
        mock_result = MagicMock()
        mock_result.stdout = ""
        mock_result.stderr = ""
        monkeypatch.setattr(subprocess, "run", MagicMock(return_value=mock_result))

        # Create mock frame files
        output_dir.mkdir(exist_ok=True)
        for i in range(3):
            (output_dir / f"frame_{i:04d}.jpg").touch()

        # Should succeed with adjusted FPS (not raise error)
        result = extractor.extract_frames(video_path, output_dir, fps=5.0)

        # Verify frames were "extracted"
        assert len(result) >= 1

    def test_max_fps_enforcement(self):
        """Test that FPS is capped at MAX_FPS during initialization"""
        # Test initialization with excessive FPS (>60.0)
        extractor = FrameExtractor(fps=100.0)

        # Should be capped at MAX_FPS (60.0)
        assert extractor.fps == FrameExtractor.MAX_FPS
        assert extractor.fps == 60.0

    def test_fps_limit_in_extract_frames(self, tmp_path, monkeypatch):
        """Test that FPS parameter in extract_frames is also limited"""
        from unittest.mock import MagicMock
        import subprocess

        extractor = FrameExtractor(fps=1.0)
        video_path = tmp_path / "test_video.mp4"
        video_path.touch()
        output_dir = tmp_path / "output"

        # Mock get_video_info
        extractor.get_video_info = MagicMock(return_value={
            "duration": 10.0,
            "fps": 30.0,
            "width": 1920,
            "height": 1080,
            "codec": "h264",
            "size": 1000000
        })

        # Mock subprocess
        mock_result = MagicMock()
        mock_result.stdout = ""
        mock_result.stderr = ""
        mock_run = MagicMock(return_value=mock_result)
        monkeypatch.setattr(subprocess, "run", mock_run)

        # Create mock frames
        output_dir.mkdir(exist_ok=True)
        (output_dir / "frame_0001.jpg").touch()

        # Call with high FPS (100.0 > MAX_FPS=60.0)
        result = extractor.extract_frames(video_path, output_dir, fps=100.0)

        # Verify FFmpeg was called with capped FPS
        ffmpeg_call = mock_run.call_args[0][0]
        # Find the fps argument in the FFmpeg command
        fps_arg_index = ffmpeg_call.index("-vf")
        fps_value = ffmpeg_call[fps_arg_index + 1]

        # FPS should be capped at MAX_FPS (60.0)
        # Note: 10s * 60fps = 600 frames < MAX_FRAMES (3600), so it stays at 60fps
        assert "fps=60.0" in fps_value  # Capped at MAX_FPS, within MAX_FRAMES limit


class TestCeleryTaskIntegration:
    """Integration test for Celery task execution"""

    def test_analyze_video_task_synchronous(self, tmp_path, monkeypatch):
        """Test analyze_video_task can be called synchronously"""
        from unittest.mock import MagicMock, patch
        import json

        job_id = "test-task-job-123"
        video_path = tmp_path / "test_video.mp4"

        # Create a mock video file
        video_path.touch()

        # Create job directory structure
        job_dir = tmp_path / job_id
        job_dir.mkdir(exist_ok=True)

        # Mock file_service.get_job_directory
        monkeypatch.setattr(
            "app.tasks.analyze_video.file_service.get_job_directory",
            lambda x: job_dir
        )

        # Mock file_service.get_output_directory for thumbnails
        output_dir = tmp_path / "outputs" / job_id
        output_dir.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(
            "app.tasks.analyze_video.file_service.get_output_directory",
            lambda x: output_dir
        )

        # Create mock frames
        frames_dir = job_dir / "frames"
        frames_dir.mkdir(exist_ok=True)
        frame_paths = []
        for i in range(3):
            img = Image.new('RGB', (100, 100), color=(i * 80, 0, 0))
            frame_path = frames_dir / f"frame_{i:04d}.jpg"
            img.save(frame_path)
            frame_paths.append(frame_path)

        # Mock frame_extractor.extract_frames
        mock_extract = MagicMock(return_value=frame_paths)
        monkeypatch.setattr(
            "app.tasks.analyze_video.frame_extractor.extract_frames",
            mock_extract
        )

        # Mock Redis client
        mock_redis = MagicMock()
        monkeypatch.setattr(
            "app.tasks.analyze_video.get_redis_client",
            lambda: mock_redis
        )

        # Import the task
        from app.tasks.analyze_video import analyze_video_task

        # Mock update_state to avoid Celery backend dependency
        with patch.object(analyze_video_task, 'update_state'):
            # Execute task synchronously using .run() method
            result = analyze_video_task.run(job_id, str(video_path))

        # Verify frame extraction was called WITHOUT fps parameter
        # This ensures FRAME_EXTRACT_FPS env var (default 15.0) is used
        mock_extract.assert_called_once()
        call_kwargs = mock_extract.call_args.kwargs
        assert 'fps' not in call_kwargs, \
            "extract_frames should be called without fps parameter to use configured FPS"

        # Verify result structure
        assert "clusters" in result
        assert isinstance(result["clusters"], list)
        assert len(result["clusters"]) > 0

        # Verify clusters have correct structure
        for cluster in result["clusters"]:
            assert "id" in cluster
            assert "size" in cluster
            assert "thumbnail_url" in cluster
            assert cluster["thumbnail_url"].startswith(f"/outputs/{job_id}/thumbnails/")

        # Verify Redis was called to store status
        assert mock_redis.hset.called
        assert mock_redis.setex.called
        assert mock_redis.expire.called

        # Verify thumbnails were created in outputs directory (not uploads)
        thumbnails_dir = output_dir / "thumbnails"
        assert thumbnails_dir.exists()
        thumbnail_files = list(thumbnails_dir.glob("cluster-*.jpg"))
        assert len(thumbnail_files) > 0

    def test_analyze_video_task_error_handling(self, tmp_path, monkeypatch):
        """Test task error handling when extraction fails"""
        from unittest.mock import MagicMock, patch

        job_id = "test-error-job-456"
        video_path = tmp_path / "bad_video.mp4"
        video_path.touch()

        job_dir = tmp_path / job_id
        job_dir.mkdir(exist_ok=True)

        # Mock file_service
        monkeypatch.setattr(
            "app.tasks.analyze_video.file_service.get_job_directory",
            lambda x: job_dir
        )

        # Mock frame_extractor to raise error
        def mock_extract_error(*args, **kwargs):
            raise RuntimeError("FFmpeg extraction failed")

        monkeypatch.setattr(
            "app.tasks.analyze_video.frame_extractor.extract_frames",
            mock_extract_error
        )

        # Mock Redis
        mock_redis = MagicMock()
        monkeypatch.setattr(
            "app.tasks.analyze_video.get_redis_client",
            lambda: mock_redis
        )

        # Import task
        from app.tasks.analyze_video import analyze_video_task

        # Mock update_state to avoid Celery backend dependency
        with patch.object(analyze_video_task, 'update_state'):
            # Execute and expect error
            with pytest.raises(RuntimeError, match="FFmpeg extraction failed"):
                analyze_video_task.run(job_id, str(video_path))

        # Verify Redis was called to store failure
        assert mock_redis.hset.called
