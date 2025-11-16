"""
Tests for cleanup tasks
"""

import pytest
from pathlib import Path
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock


class TestCleanupOldJobs:
    """Test cleanup_old_jobs task"""

    def test_cleanup_old_jobs_removes_old_directories(self, tmp_path):
        """Test that old directories are removed based on retention period"""
        from app.tasks.cleanup import cleanup_old_jobs, RETENTION_HOURS
        from app.tasks.cleanup import _cleanup_directory

        # Create test structure
        uploads_dir = tmp_path / "uploads"
        uploads_dir.mkdir()

        # Create old job (25 hours ago - should be deleted)
        old_job = uploads_dir / "old-job-123"
        old_job.mkdir()
        (old_job / "original.mp4").write_text("old content")

        # Set modification time to 25 hours ago
        old_time = datetime.now(timezone.utc) - timedelta(hours=25)
        old_timestamp = old_time.timestamp()
        import os
        os.utime(old_job, (old_timestamp, old_timestamp))

        # Create recent job (1 hour ago - should be kept)
        recent_job = uploads_dir / "recent-job-456"
        recent_job.mkdir()
        (recent_job / "original.mp4").write_text("recent content")

        # Run cleanup
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=RETENTION_HOURS)
        stats = _cleanup_directory(uploads_dir, cutoff_time, "uploads")

        # Verify old job removed, recent job kept
        assert not old_job.exists()
        assert recent_job.exists()
        assert stats["uploads_removed"] == 1
        assert stats["bytes_freed"] > 0

    def test_cleanup_old_jobs_empty_directory(self, tmp_path):
        """Test cleanup with empty directory"""
        from app.tasks.cleanup import _cleanup_directory
        from datetime import timedelta

        uploads_dir = tmp_path / "uploads"
        uploads_dir.mkdir()

        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)
        stats = _cleanup_directory(uploads_dir, cutoff_time, "uploads")

        assert stats["uploads_removed"] == 0
        assert stats["bytes_freed"] == 0

    def test_cleanup_old_jobs_only_directories(self, tmp_path):
        """Test that cleanup only processes directories, not files"""
        from app.tasks.cleanup import _cleanup_directory
        from datetime import timedelta

        uploads_dir = tmp_path / "uploads"
        uploads_dir.mkdir()

        # Create a file (not directory) - should be ignored
        (uploads_dir / "random-file.txt").write_text("test")

        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)
        stats = _cleanup_directory(uploads_dir, cutoff_time, "uploads")

        # File should still exist
        assert (uploads_dir / "random-file.txt").exists()
        assert stats["uploads_removed"] == 0

    def test_cleanup_old_jobs_calculates_size(self, tmp_path):
        """Test that cleanup correctly calculates freed bytes"""
        from app.tasks.cleanup import _cleanup_directory
        from datetime import timedelta

        uploads_dir = tmp_path / "uploads"
        uploads_dir.mkdir()

        # Create old job with known size
        old_job = uploads_dir / "old-job-789"
        old_job.mkdir()
        test_content = "x" * 1000  # 1000 bytes
        (old_job / "file1.txt").write_text(test_content)
        (old_job / "file2.txt").write_text(test_content)

        # Set old modification time
        old_time = datetime.now(timezone.utc) - timedelta(hours=25)
        old_timestamp = old_time.timestamp()
        import os
        os.utime(old_job, (old_timestamp, old_timestamp))

        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)
        stats = _cleanup_directory(uploads_dir, cutoff_time, "uploads")

        assert stats["bytes_freed"] >= 2000  # At least 2000 bytes


class TestCleanupJob:
    """Test cleanup_job task"""

    def test_cleanup_job_removes_uploads_and_outputs(self, tmp_path):
        """Test that cleanup_job removes both uploads and outputs directories"""
        from app.tasks.cleanup import cleanup_job

        job_id = "test-cleanup-job-123"

        # Create uploads directory
        uploads_dir = tmp_path / "uploads" / job_id
        uploads_dir.mkdir(parents=True)
        (uploads_dir / "original.mp4").write_text("video content")

        # Create outputs directory
        outputs_dir = tmp_path / "outputs" / job_id
        outputs_dir.mkdir(parents=True)
        (outputs_dir / "result.mp4").write_text("result content")

        # Mock Path to use tmp_path
        with patch("app.tasks.cleanup.Path") as mock_path:
            mock_path.return_value = tmp_path

            # Call cleanup_job with patched paths
            def path_side_effect(arg):
                if arg == "uploads":
                    return tmp_path / "uploads"
                elif arg == "outputs":
                    return tmp_path / "outputs"
                return tmp_path / arg

            mock_path.side_effect = path_side_effect

            result = cleanup_job(job_id)

        # Verify directories removed
        assert not uploads_dir.exists()
        assert not outputs_dir.exists()
        assert result is True

    def test_cleanup_job_nonexistent_directories(self, tmp_path):
        """Test cleanup_job with non-existent directories"""
        from app.tasks.cleanup import cleanup_job

        job_id = "nonexistent-job-456"

        # Mock Path to use tmp_path
        with patch("app.tasks.cleanup.Path") as mock_path:
            mock_path.return_value = tmp_path

            def path_side_effect(arg):
                if arg == "uploads":
                    return tmp_path / "uploads"
                elif arg == "outputs":
                    return tmp_path / "outputs"
                return tmp_path / arg

            mock_path.side_effect = path_side_effect

            result = cleanup_job(job_id)

        # Should succeed even if directories don't exist
        assert result is True

    def test_cleanup_job_partial_failure(self, tmp_path):
        """Test cleanup_job when one directory fails to delete"""
        from app.tasks.cleanup import cleanup_job
        import shutil

        job_id = "partial-fail-job-789"

        # Create uploads directory
        uploads_dir = tmp_path / "uploads" / job_id
        uploads_dir.mkdir(parents=True)
        (uploads_dir / "original.mp4").write_text("video content")

        # Mock shutil.rmtree to fail for uploads
        original_rmtree = shutil.rmtree

        def mock_rmtree(path, *args, **kwargs):
            if "uploads" in str(path):
                raise PermissionError("Cannot delete uploads")
            return original_rmtree(path, *args, **kwargs)

        with patch("app.tasks.cleanup.Path") as mock_path, \
             patch("shutil.rmtree", side_effect=mock_rmtree):

            def path_side_effect(arg):
                if arg == "uploads":
                    return tmp_path / "uploads"
                elif arg == "outputs":
                    return tmp_path / "outputs"
                return tmp_path / arg

            mock_path.side_effect = path_side_effect

            result = cleanup_job(job_id)

        # Should return False on partial failure
        assert result is False


class TestCleanupIntegration:
    """Integration tests for cleanup functionality"""

    def test_cleanup_old_jobs_full_workflow(self, tmp_path):
        """Test full cleanup workflow with both uploads and outputs"""
        from app.tasks.cleanup import cleanup_old_jobs
        from datetime import timedelta

        # Create test directory structure
        base_dir = tmp_path

        # Old uploads
        old_uploads = base_dir / "uploads" / "old-job"
        old_uploads.mkdir(parents=True)
        (old_uploads / "video.mp4").write_text("old video")

        # Old outputs
        old_outputs = base_dir / "outputs" / "old-job"
        old_outputs.mkdir(parents=True)
        (old_outputs / "result.mp4").write_text("old result")

        # Recent uploads
        recent_uploads = base_dir / "uploads" / "recent-job"
        recent_uploads.mkdir(parents=True)
        (recent_uploads / "video.mp4").write_text("recent video")

        # Set old modification time
        old_time = datetime.now(timezone.utc) - timedelta(hours=25)
        old_timestamp = old_time.timestamp()
        import os
        os.utime(old_uploads.parent / "old-job", (old_timestamp, old_timestamp))
        os.utime(old_outputs.parent / "old-job", (old_timestamp, old_timestamp))

        # Mock Path to use tmp_path
        with patch("app.tasks.cleanup.Path") as mock_path:
            def path_side_effect(arg):
                if arg == "uploads":
                    return base_dir / "uploads"
                elif arg == "outputs":
                    return base_dir / "outputs"
                return base_dir / arg

            mock_path.side_effect = path_side_effect

            stats = cleanup_old_jobs()

        # Verify old jobs removed, recent kept
        assert not old_uploads.exists()
        assert not old_outputs.exists()
        assert recent_uploads.exists()
        assert stats["uploads_removed"] >= 1
        assert stats["bytes_freed"] > 0
