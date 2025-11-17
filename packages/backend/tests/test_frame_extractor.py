"""
Tests for frame extraction service

Verifies FPS configuration, dynamic adjustment logic, and environment variable support.
"""

import pytest
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import os
from app.services.frame_extractor import FrameExtractor


class TestFrameExtractorConfiguration:
    """Test FPS configuration and limits"""

    def test_default_fps_from_environment(self, monkeypatch):
        """Test that default FPS is read from FRAME_EXTRACT_FPS environment variable"""
        monkeypatch.setenv("FRAME_EXTRACT_FPS", "20.0")

        extractor = FrameExtractor()
        assert extractor.fps == 20.0

    def test_default_fps_without_environment(self, monkeypatch):
        """Test that default FPS is 60.0 when environment variable is not set"""
        monkeypatch.delenv("FRAME_EXTRACT_FPS", raising=False)

        extractor = FrameExtractor()
        assert extractor.fps == 60.0  # YouTube standard, maximum detail

    def test_explicit_fps_overrides_environment(self, monkeypatch):
        """Test that explicit FPS parameter overrides environment variable"""
        monkeypatch.setenv("FRAME_EXTRACT_FPS", "20.0")

        extractor = FrameExtractor(fps=10.0)
        assert extractor.fps == 10.0

    def test_max_fps_limit(self):
        """Test that FPS is capped at MAX_FPS (60.0)"""
        extractor = FrameExtractor(fps=100.0)
        assert extractor.fps == 60.0  # Should be capped at MAX_FPS

    def test_max_fps_constant(self):
        """Verify MAX_FPS constant is 60.0"""
        assert FrameExtractor.MAX_FPS == 60.0


class TestFrameExtractionDynamicAdjustment:
    """Test dynamic FPS adjustment for different video lengths"""

    @patch('app.services.frame_extractor.subprocess.run')
    @patch.object(FrameExtractor, 'get_video_info')
    def test_short_video_uses_high_fps(self, mock_get_info, mock_subprocess, tmp_path):
        """
        Test that short videos (<5s) can use high FPS (up to MAX_FPS=60)

        Scenario: 3-second animation should extract at 60fps (180 frames < MAX_FRAMES=300)
        """
        # Mock video metadata: 3 seconds, 30fps
        mock_get_info.return_value = {
            "duration": 3.0,
            "fps": 30.0,
            "width": 1920,
            "height": 1080,
            "codec": "h264",
            "size": 1000000
        }

        # Mock ffmpeg success
        mock_subprocess.return_value = Mock(
            returncode=0,
            stdout="",
            stderr="frame=  180 fps= 60"
        )

        # Create mock video file and output directory
        video_path = tmp_path / "short_animation.mp4"
        video_path.write_bytes(b"fake video")
        output_dir = tmp_path / "frames"

        # Create expected frame files
        output_dir.mkdir()
        for i in range(1, 181):  # 3s * 60fps = 180 frames
            (output_dir / f"frame_{i:04d}.jpg").write_bytes(b"fake frame")

        # Extract frames with high FPS
        extractor = FrameExtractor(fps=60.0)
        frames = extractor.extract_frames(video_path, output_dir, fps=60.0)

        # Verify high FPS was used
        assert len(frames) == 180  # 3s * 60fps

        # Verify ffmpeg was called with correct FPS
        ffmpeg_cmd = mock_subprocess.call_args[0][0]
        assert "-vf" in ffmpeg_cmd
        fps_index = ffmpeg_cmd.index("-vf") + 1
        assert "fps=60" in ffmpeg_cmd[fps_index]

    @patch('app.services.frame_extractor.subprocess.run')
    @patch.object(FrameExtractor, 'get_video_info')
    def test_long_video_reduces_fps_automatically(self, mock_get_info, mock_subprocess, tmp_path, monkeypatch):
        """
        Test that long videos automatically reduce FPS to respect MAX_FRAMES limit

        Scenario: 30-second video with requested 15fps would extract 450 frames,
        but should be automatically reduced to 10fps (300 frames = MAX_FRAMES)
        """
        # Set MAX_FRAMES to 300 for this test to trigger auto-reduction
        monkeypatch.setenv("FRAME_MAX_FRAMES", "300")

        # Mock video metadata: 30 seconds, 30fps
        mock_get_info.return_value = {
            "duration": 30.0,
            "fps": 30.0,
            "width": 1920,
            "height": 1080,
            "codec": "h264",
            "size": 10000000
        }

        # Mock ffmpeg success
        mock_subprocess.return_value = Mock(
            returncode=0,
            stdout="",
            stderr="frame=  300 fps= 10"
        )

        # Create mock video file and output directory
        video_path = tmp_path / "long_video.mp4"
        video_path.write_bytes(b"fake video")
        output_dir = tmp_path / "frames"

        # Create expected frame files (300 frames after auto-reduction)
        output_dir.mkdir()
        for i in range(1, 301):  # MAX_FRAMES = 300
            (output_dir / f"frame_{i:04d}.jpg").write_bytes(b"fake frame")

        # Extract frames with 15fps (should be auto-reduced to 10fps)
        extractor = FrameExtractor(fps=15.0)  # Will read MAX_FRAMES=300 from env
        frames = extractor.extract_frames(video_path, output_dir, fps=15.0)

        # Verify FPS was automatically reduced
        assert len(frames) == 300  # MAX_FRAMES limit

        # Verify ffmpeg was called with reduced FPS (~10fps)
        ffmpeg_cmd = mock_subprocess.call_args[0][0]
        assert "-vf" in ffmpeg_cmd
        fps_index = ffmpeg_cmd.index("-vf") + 1
        # FPS should be reduced to 300/30 = 10fps
        assert "fps=10.0" in ffmpeg_cmd[fps_index]

    @patch('app.services.frame_extractor.subprocess.run')
    @patch.object(FrameExtractor, 'get_video_info')
    def test_medium_video_uses_requested_fps(self, mock_get_info, mock_subprocess, tmp_path):
        """
        Test that medium-length videos use requested FPS if within limits

        Scenario: 10-second video with 15fps = 150 frames (< MAX_FRAMES=300)
        """
        # Mock video metadata: 10 seconds, 30fps
        mock_get_info.return_value = {
            "duration": 10.0,
            "fps": 30.0,
            "width": 1920,
            "height": 1080,
            "codec": "h264",
            "size": 5000000
        }

        # Mock ffmpeg success
        mock_subprocess.return_value = Mock(
            returncode=0,
            stdout="",
            stderr="frame=  150 fps= 15"
        )

        # Create mock video file and output directory
        video_path = tmp_path / "medium_video.mp4"
        video_path.write_bytes(b"fake video")
        output_dir = tmp_path / "frames"

        # Create expected frame files
        output_dir.mkdir()
        for i in range(1, 151):  # 10s * 15fps = 150 frames
            (output_dir / f"frame_{i:04d}.jpg").write_bytes(b"fake frame")

        # Extract frames with 15fps
        extractor = FrameExtractor(fps=15.0)
        frames = extractor.extract_frames(video_path, output_dir, fps=15.0)

        # Verify requested FPS was used
        assert len(frames) == 150  # 10s * 15fps

        # Verify ffmpeg was called with requested FPS
        ffmpeg_cmd = mock_subprocess.call_args[0][0]
        assert "-vf" in ffmpeg_cmd
        fps_index = ffmpeg_cmd.index("-vf") + 1
        assert "fps=15.0" in ffmpeg_cmd[fps_index]


class TestFrameExtractionEdgeCases:
    """Test edge cases and error handling"""

    @patch.object(FrameExtractor, 'get_video_info')
    def test_video_exceeds_max_duration(self, mock_get_info, tmp_path):
        """Test that videos exceeding MAX_DURATION_SECONDS are rejected"""
        # Mock video metadata: 10 minutes (exceeds MAX_DURATION_SECONDS=300)
        mock_get_info.return_value = {
            "duration": 600.0,  # 10 minutes
            "fps": 30.0,
            "width": 1920,
            "height": 1080,
            "codec": "h264",
            "size": 50000000
        }

        video_path = tmp_path / "too_long.mp4"
        video_path.write_bytes(b"fake video")
        output_dir = tmp_path / "frames"

        extractor = FrameExtractor()

        with pytest.raises(RuntimeError, match="exceeds maximum allowed"):
            extractor.extract_frames(video_path, output_dir)

    @patch('app.services.frame_extractor.subprocess.run')
    @patch.object(FrameExtractor, 'get_video_info')
    def test_frame_max_frames_env_var(self, mock_get_info, mock_subprocess, tmp_path, monkeypatch):
        """
        Test that FRAME_MAX_FRAMES environment variable is respected

        Scenario: Set FRAME_MAX_FRAMES=900 to allow longer videos at 15fps
        A 42-second video at 15fps = 630 frames (would exceed default 300, but ok with 900)
        """
        # Set environment variable
        monkeypatch.setenv("FRAME_MAX_FRAMES", "900")

        # Mock video metadata: 42 seconds, 30fps
        mock_get_info.return_value = {
            "duration": 42.0,
            "fps": 30.0,
            "width": 1920,
            "height": 1080,
            "codec": "h264",
            "size": 15000000
        }

        # Mock ffmpeg success
        mock_subprocess.return_value = Mock(
            returncode=0,
            stdout="",
            stderr="frame=  630 fps= 15"
        )

        # Create mock video file and output directory
        video_path = tmp_path / "long_video_with_high_limit.mp4"
        video_path.write_bytes(b"fake video")
        output_dir = tmp_path / "frames"

        # Create expected frame files (630 frames, not reduced)
        output_dir.mkdir()
        for i in range(1, 631):
            (output_dir / f"frame_{i:04d}.jpg").write_bytes(b"fake frame")

        # Extract frames with 15fps (should NOT be reduced because MAX_FRAMES=900)
        extractor = FrameExtractor(fps=15.0)  # Will read FRAME_MAX_FRAMES=900 from env
        frames = extractor.extract_frames(video_path, output_dir, fps=15.0)

        # Verify FPS was NOT reduced (630 < 900)
        assert len(frames) == 630  # Full frames extracted

        # Verify ffmpeg was called with full 15fps (not reduced)
        ffmpeg_cmd = mock_subprocess.call_args[0][0]
        assert "-vf" in ffmpeg_cmd
        fps_index = ffmpeg_cmd.index("-vf") + 1
        assert "fps=15.0" in ffmpeg_cmd[fps_index]

    def test_video_file_not_found(self, tmp_path):
        """Test that missing video file raises FileNotFoundError"""
        video_path = tmp_path / "nonexistent.mp4"
        output_dir = tmp_path / "frames"

        extractor = FrameExtractor()

        with pytest.raises(FileNotFoundError, match="Video file not found"):
            extractor.extract_frames(video_path, output_dir)


class TestSingletonInstance:
    """Test the singleton instance creation"""

    def test_singleton_uses_environment_variable(self, monkeypatch):
        """Test that the singleton instance reads from environment"""
        monkeypatch.setenv("FRAME_EXTRACT_FPS", "25.0")

        # Re-import to get fresh singleton (in practice, this runs once at startup)
        from app.services.frame_extractor import frame_extractor as extractor

        # Note: In tests, the singleton is already created, so we test the class behavior
        new_extractor = FrameExtractor()
        assert new_extractor.fps == 25.0
