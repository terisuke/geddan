"""
Video composer service for generating final video from user captures.

Performance optimizations:
- H.264 preset tuning (veryfast for speed, medium for quality)
- CRF-based quality control instead of fixed bitrate
- Multi-threaded encoding with configurable thread count
- Hardware encoding support (videotoolbox/nvenc)
- Efficient audio passthrough
"""

import ffmpeg
import logging
from pathlib import Path
from typing import Dict, List, Optional
import shutil
import json
import os
import platform

logger = logging.getLogger(__name__)

# Performance configuration
DEFAULT_THREAD_COUNT = os.cpu_count() or 4
ENCODE_THREADS = int(os.getenv("FFMPEG_ENCODE_THREADS", str(DEFAULT_THREAD_COUNT)))
ENCODE_PRESET = os.getenv("FFMPEG_ENCODE_PRESET", "veryfast")  # ultrafast, veryfast, fast, medium
ENCODE_CRF = int(os.getenv("FFMPEG_ENCODE_CRF", "23"))  # 18-28 is reasonable, lower=better quality
USE_HW_ENCODING = os.getenv("FFMPEG_HW_ENCODE", "auto").lower()  # auto, on, off


def _detect_hw_encoder() -> Optional[str]:
    """
    Detect available hardware encoder for H.264.

    Returns:
        Encoder name (h264_videotoolbox, h264_nvenc) or None.
    """
    if USE_HW_ENCODING == "off":
        return None

    system = platform.system().lower()

    if system == "darwin":
        # macOS: VideoToolbox encoder
        return "h264_videotoolbox"
    elif system == "linux":
        # Linux: Try NVIDIA NVENC
        try:
            import subprocess

            result = subprocess.run(
                ["ffmpeg", "-encoders"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if "h264_nvenc" in result.stdout:
                return "h264_nvenc"
        except Exception:
            pass

    if USE_HW_ENCODING == "auto":
        return None
    else:
        logger.warning("Hardware encoding requested but not available")
        return None


class VideoComposer:
    """
    Video composer for generating final video from user captures.

    Performance optimizations:
    - Configurable encoding preset (veryfast by default)
    - CRF-based quality control
    - Multi-threaded encoding
    - Optional hardware encoding
    """

    def __init__(
        self,
        output_dir: Optional[str] = None,
        threads: int = ENCODE_THREADS,
        preset: str = ENCODE_PRESET,
        crf: int = ENCODE_CRF,
    ):
        """
        Initialize VideoComposer.

        Args:
            output_dir: Default output directory.
            threads: Number of encoding threads.
            preset: H.264 encoding preset (ultrafast, veryfast, fast, medium, slow).
            crf: Constant Rate Factor for quality (18-28, lower is better).
        """
        self.output_dir = Path(output_dir) if output_dir else None
        self.threads = threads
        self.preset = preset
        self.crf = crf
        self._hw_encoder = _detect_hw_encoder()

        logger.info(
            f"VideoComposer initialized: threads={threads}, preset={preset}, "
            f"crf={crf}, hw_encoder={self._hw_encoder or 'libx264'}"
        )

    def compose_video(
        self,
        job_id: str,
        captures_dir: Path,
        frame_mapping: Dict[int, int],
        original_video_path: Path,
        output_path: Path,
        fps: float = 24.0,
    ) -> bool:
        """
        Compose final video from user captures based on frame mapping

        Args:
            job_id: Job identifier
            captures_dir: Directory containing user captured images (cluster-X.png)
            frame_mapping: Mapping from frame index to cluster ID
            original_video_path: Path to original uploaded video (for audio)
            output_path: Path to save generated video
            fps: Frames per second for the output video

        Returns:
            True if successful, False otherwise
        """
        try:
            work_dir = captures_dir.parent / "composition_work"
            work_dir.mkdir(exist_ok=True)
            
            sequence_dir = work_dir / "sequence"
            sequence_dir.mkdir(exist_ok=True)

            # 1. Create image sequence based on mapping
            logger.info(f"[{job_id}] Creating frame sequence from {len(frame_mapping)} frames...")
            
            # Find max frame index to ensure we process all frames
            max_frame_idx = max(int(k) for k in frame_mapping.keys())
            
            for frame_idx in range(max_frame_idx + 1):
                cluster_id = frame_mapping.get(frame_idx)
                if cluster_id is None:
                    # Helper: if frame mapping is sparse, use previous frame or skip
                    # Currently we assume complete mapping from HashAnalyzer
                    # Use string keys because JSON keys are always strings
                    cluster_id = frame_mapping.get(str(frame_idx))
                
                if cluster_id is None:
                     logger.warning(f"[{job_id}] No cluster for frame index {frame_idx}, skipping")
                     continue

                # Look for user capture for this cluster
                # Try multiple extensions
                capture_path = None
                for ext in [".png", ".jpg", ".jpeg"]:
                    p = captures_dir / f"cluster-{cluster_id}{ext}"
                    if p.exists():
                        capture_path = p
                        break
                
                if not capture_path:
                    logger.warning(f"[{job_id}] No capture found for cluster {cluster_id}")
                    # Fallback: maybe use a placeholder or skip
                    # For now we create a black frame or duplicate previous
                    continue

                # Copy to sequence directory with sequential naming
                # FFmpeg expects frame_0001.png, frame_0002.png...
                target_path = sequence_dir / f"frame_{frame_idx:04d}.png"
                shutil.copy2(capture_path, target_path)

            # 2. Extract audio from original video
            audio_path = work_dir / "audio.aac"
            has_audio = self._extract_audio(original_video_path, audio_path)

            # 3. Encode video
            logger.info(f"[{job_id}] Encoding video to {output_path}...")
            
            input_pattern = str(sequence_dir / "frame_%04d.png")
            
            # Setup input stream
            video_input = ffmpeg.input(input_pattern, framerate=fps)

            # Build optimized output arguments
            output_args = self._build_encode_args(has_audio)

            if has_audio:
                audio_input = ffmpeg.input(str(audio_path))
                stream = ffmpeg.output(
                    video_input,
                    audio_input,
                    str(output_path),
                    **output_args
                )
            else:
                stream = ffmpeg.output(
                    video_input,
                    str(output_path),
                    **output_args
                )

            # Run ffmpeg
            ffmpeg.run(stream, capture_stdout=True, capture_stderr=True, overwrite_output=True)
            
            # Cleanup
            shutil.rmtree(work_dir, ignore_errors=True)
            
            logger.info(f"[{job_id}] Video composition completed")
            return True

        except ffmpeg.Error as e:
            logger.error(f"[{job_id}] FFmpeg encoding failed: {e.stderr.decode() if e.stderr else str(e)}")
            return False
        except Exception as e:
            logger.error(f"[{job_id}] Video composition failed: {e}", exc_info=True)
            return False

    def _build_encode_args(self, has_audio: bool) -> Dict:
        """
        Build optimized FFmpeg encoding arguments.

        Args:
            has_audio: Whether output will have audio.

        Returns:
            Dictionary of ffmpeg output arguments.
        """
        args = {
            "pix_fmt": "yuv420p",
            "shortest": None,  # Stop at shortest input
            "threads": self.threads,
        }

        # Select encoder and settings
        if self._hw_encoder:
            args["c:v"] = self._hw_encoder
            # Hardware encoders have different quality parameters
            if self._hw_encoder == "h264_videotoolbox":
                # VideoToolbox uses bitrate or quality-based encoding
                args["b:v"] = "5M"  # 5 Mbps for good quality
            elif self._hw_encoder == "h264_nvenc":
                # NVENC supports CQ mode similar to CRF
                args["cq"] = self.crf
                args["preset"] = "p4"  # Medium preset for NVENC
        else:
            # Software encoder (libx264)
            args["c:v"] = "libx264"
            args["preset"] = self.preset
            args["crf"] = self.crf

        # Audio settings (if present)
        if has_audio:
            args["c:a"] = "aac"
            args["b:a"] = "128k"

        return args

    def _extract_audio(self, video_path: Path, output_path: Path) -> bool:
        """
        Extract audio from video file if exists.

        Uses copy codec for speed when possible.

        Args:
            video_path: Source video path.
            output_path: Output audio path.

        Returns:
            True if audio was extracted successfully.
        """
        try:
            # Check if video has audio stream
            probe = ffmpeg.probe(str(video_path))
            audio_streams = [s for s in probe["streams"] if s["codec_type"] == "audio"]

            if not audio_streams:
                return False

            audio_codec = audio_streams[0].get("codec_name", "")

            # Use copy if already AAC, otherwise transcode
            if audio_codec == "aac":
                (
                    ffmpeg
                    .input(str(video_path))
                    .output(str(output_path), vn=None, acodec="copy")
                    .run(capture_stdout=True, capture_stderr=True, overwrite_output=True)
                )
            else:
                (
                    ffmpeg
                    .input(str(video_path))
                    .output(str(output_path), vn=None, acodec="aac", **{"b:a": "128k"})
                    .run(capture_stdout=True, capture_stderr=True, overwrite_output=True)
                )

            return True
        except Exception as e:
            logger.warning(f"Audio extraction failed (ignoring): {e}")
            return False


# Singleton instance
video_composer = VideoComposer()
