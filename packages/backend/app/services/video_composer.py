"""
Video composer service for generating final video from user captures
"""

import ffmpeg
import logging
from pathlib import Path
from typing import Dict, List, Optional
import shutil
import json

logger = logging.getLogger(__name__)


class VideoComposer:
    def __init__(self, output_dir: Optional[str] = None):
        self.output_dir = Path(output_dir) if output_dir else None

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
            
            output_args = {
                'c:v': 'libx264',
                'pix_fmt': 'yuv420p',
                'shortest': None,  # Stop at shortest input
            }

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

    def _extract_audio(self, video_path: Path, output_path: Path) -> bool:
        """Extract audio from video file if exists"""
        try:
            # Check if video has audio stream
            probe = ffmpeg.probe(str(video_path))
            has_audio = any(s['codec_type'] == 'audio' for s in probe['streams'])
            
            if not has_audio:
                return False

            (
                ffmpeg
                .input(str(video_path))
                .output(str(output_path), vn=None, acodec='aac')
                .run(capture_stdout=True, capture_stderr=True, overwrite_output=True)
            )
            return True
        except Exception as e:
            logger.warning(f"Audio extraction failed (ignoring): {e}")
            return False


# Singleton instance
video_composer = VideoComposer()
