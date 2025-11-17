"""
Frame extraction service using FFmpeg

Extracts frames from video files at configurable FPS (default: 15fps from env)
with dynamic adjustment to prevent resource exhaustion while capturing sufficient
detail for pose analysis.

Configurable via FRAME_EXTRACT_FPS environment variable.
"""

import subprocess
import logging
from pathlib import Path
from typing import List, Optional
import os

logger = logging.getLogger(__name__)


class FrameExtractor:
    """Extract frames from video files using FFmpeg"""

    # Safety limits to prevent resource exhaustion
    MAX_DURATION_SECONDS = 300  # 5 minutes max
    MAX_FPS = 60.0  # Maximum extraction FPS (allows high-FPS for short animations)

    def __init__(self, fps: Optional[float] = None, max_frames: Optional[int] = None):
        """
        Initialize FrameExtractor

        Args:
            fps: Frames per second to extract
                 If None, reads from FRAME_EXTRACT_FPS env var (default: 60.0)
                 Automatically reduced for longer videos to respect FRAME_MAX_FRAMES
                 High default (60fps) ensures maximum detail for short videos
            max_frames: Maximum number of frames to extract
                 If None, reads from FRAME_MAX_FRAMES env var (default: 300)
                 Dynamic FPS adjustment keeps extracted frames within this limit
        """
        # Read FPS from environment variable if not provided
        if fps is None:
            fps = float(os.getenv("FRAME_EXTRACT_FPS", "60.0"))
            logger.debug(f"Using FPS from environment: {fps}")

        # Read MAX_FRAMES from environment variable if not provided
        if max_frames is None:
            max_frames = int(os.getenv("FRAME_MAX_FRAMES", "3600"))
            logger.debug(f"Using MAX_FRAMES from environment: {max_frames}")

        self.fps = min(fps, self.MAX_FPS)  # Enforce FPS limit
        self.MAX_FRAMES = max_frames  # Configurable frame limit

        if fps > self.MAX_FPS:
            logger.warning(f"FPS {fps} exceeds limit, capped at {self.MAX_FPS}")

    def extract_frames(
        self,
        video_path: Path,
        output_dir: Path,
        fps: Optional[float] = None,
    ) -> List[Path]:
        """
        Extract frames from video at specified FPS

        Args:
            video_path: Path to input video file
            output_dir: Directory to save extracted frames
            fps: Override default FPS (optional)

        Returns:
            List of paths to extracted frame files

        Raises:
            FileNotFoundError: If video file doesn't exist
            RuntimeError: If FFmpeg extraction fails or video exceeds limits
        """
        if not video_path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        # Use provided FPS or default (enforce limit)
        extraction_fps = fps if fps is not None else self.fps
        extraction_fps = min(extraction_fps, self.MAX_FPS)

        # Pre-validate video metadata
        try:
            video_info = self.get_video_info(video_path)
            duration = video_info["duration"]
            original_fps = video_info["fps"]

            # Check duration limit
            if duration > self.MAX_DURATION_SECONDS:
                raise RuntimeError(
                    f"Video duration ({duration:.1f}s) exceeds maximum "
                    f"allowed ({self.MAX_DURATION_SECONDS}s)"
                )

            # Estimate frame count
            estimated_frames = int(duration * extraction_fps)
            if estimated_frames > self.MAX_FRAMES:
                # Adjust FPS to stay within frame limit
                adjusted_fps = self.MAX_FRAMES / duration

                # Calculate recommended MAX_FRAMES to maintain desired FPS
                recommended_max_frames = int(duration * extraction_fps)

                logger.warning(
                    f"Estimated {estimated_frames} frames exceeds limit ({self.MAX_FRAMES}). "
                    f"Reducing FPS from {extraction_fps:.2f} to {adjusted_fps:.2f}. "
                    f"To maintain {extraction_fps:.2f}fps, set FRAME_MAX_FRAMES={recommended_max_frames}"
                )
                extraction_fps = adjusted_fps

            logger.info(
                f"Video metadata: {duration:.1f}s @ {original_fps:.1f}fps, "
                f"will extract ~{int(duration * extraction_fps)} frames @ {extraction_fps:.2f}fps"
            )

        except RuntimeError as e:
            # Re-raise validation errors
            raise
        except Exception as e:
            # Log metadata errors but continue (FFprobe might fail on some files)
            logger.warning(f"Failed to get video metadata: {e}, proceeding anyway")

        # Create output directory
        output_dir.mkdir(parents=True, exist_ok=True)

        # FFmpeg command to extract frames
        # -i: input file
        # -vf fps=N: extract N frames per second
        # -q:v 2: high quality (1-31, lower is better)
        # frame_%04d.jpg: output filename pattern
        output_pattern = output_dir / "frame_%04d.jpg"

        cmd = [
            "ffmpeg",
            "-i", str(video_path),
            "-vf", f"fps={extraction_fps}",
            "-q:v", "2",  # High quality JPEGs
            str(output_pattern),
            "-y",  # Overwrite output files
        ]

        logger.info(f"Extracting frames at {extraction_fps}fps from {video_path.name}")
        logger.debug(f"FFmpeg command: {' '.join(cmd)}")

        try:
            # Run FFmpeg
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True,
            )

            logger.debug(f"FFmpeg stdout: {result.stdout}")
            logger.debug(f"FFmpeg stderr: {result.stderr}")

        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg extraction failed: {e.stderr}")
            raise RuntimeError(f"Frame extraction failed: {e.stderr}")

        # Collect extracted frame paths
        frame_files = sorted(output_dir.glob("frame_*.jpg"))

        if not frame_files:
            raise RuntimeError(f"No frames extracted from {video_path}")

        logger.info(f"Extracted {len(frame_files)} frames to {output_dir}")
        return frame_files

    def get_video_info(self, video_path: Path) -> dict:
        """
        Get video metadata using FFprobe

        Args:
            video_path: Path to video file

        Returns:
            Dictionary with video metadata (duration, fps, resolution, etc.)

        Raises:
            FileNotFoundError: If video file doesn't exist
            RuntimeError: If FFprobe fails
        """
        if not video_path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        # FFprobe command to get video info as JSON
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            "-show_format",
            str(video_path),
        ]

        logger.debug(f"FFprobe command: {' '.join(cmd)}")

        try:
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True,
            )

            import json
            metadata = json.loads(result.stdout)

            # Extract video stream info
            video_stream = next(
                (s for s in metadata.get("streams", []) if s["codec_type"] == "video"),
                None
            )

            if not video_stream:
                raise RuntimeError("No video stream found in file")

            # Parse FPS (can be in format "30/1" = 30fps)
            fps_parts = video_stream.get("r_frame_rate", "0/1").split("/")
            fps = float(fps_parts[0]) / float(fps_parts[1]) if len(fps_parts) == 2 else 0

            info = {
                "duration": float(metadata.get("format", {}).get("duration", 0)),
                "fps": fps,
                "width": video_stream.get("width", 0),
                "height": video_stream.get("height", 0),
                "codec": video_stream.get("codec_name", "unknown"),
                "size": int(metadata.get("format", {}).get("size", 0)),
            }

            logger.info(f"Video info: {info}")
            return info

        except subprocess.CalledProcessError as e:
            logger.error(f"FFprobe failed: {e.stderr}")
            raise RuntimeError(f"Failed to get video info: {e.stderr}")
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.error(f"Failed to parse FFprobe output: {e}")
            raise RuntimeError(f"Failed to parse video metadata: {e}")


# Create singleton instance with environment-configured FPS
# Default: 15fps (configurable via FRAME_EXTRACT_FPS environment variable)
# This provides a good balance between processing speed and pose detail
frame_extractor = FrameExtractor()  # Will read from FRAME_EXTRACT_FPS env var
