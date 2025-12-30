"""
Celery task for video generation
"""

import logging
from pathlib import Path
from typing import Dict, Any
import json
import time

from app.celery_worker import celery_app
from app.services.video_composer import video_composer
from app.services.file_service import file_service
from app.tasks.analyze_video import update_job_status
from app.services.redis_client import get_redis_client, execute_redis_operation

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="tasks.generate_video")
def generate_video_task(self, job_id: str, fps: float = 24.0) -> Dict[str, Any]:
    """
    Generate final video from user captures

    Args:
        job_id: Job identifier
        fps: Target FPS for the output video
    """
    logger.info(f"[{job_id}] Starting video generation task")

    # Use a separate status key for generation or update the main job status?
    # For simplicity, let's use a "generation_status" field in the main job or a separate key
    # Let's use `gen:{job_id}:state` to avoid overwriting analysis status

    gen_status_key = f"gen:{job_id}:state"

    def update_gen_status(status: str, progress: int, message: str = "", result_url: str = ""):
        """Update generation status with retry logic"""
        def _update(client):
            client.hset(gen_status_key, mapping={
                "status": status,
                "progress": str(progress),
                "message": message,
                "result_url": result_url
            })
            client.expire(gen_status_key, 86400)
            return True

        result = execute_redis_operation(
            _update,
            f"update_gen_status({job_id})"
        )
        if not result:
            logger.warning(f"[{job_id}] Failed to update generation status")
    
    try:
        update_gen_status("processing", 0, "Initializing composition...")

        # 1. Retrieve job context (frame mapping, original video path)
        job_dir = file_service.get_job_directory(job_id)

        # Get frame mapping from Redis result with retry logic
        analysis_result_key = f"job:{job_id}:result"

        def _get_analysis_result(client):
            """Retrieve analysis result from Redis"""
            if not client.exists(analysis_result_key):
                return None
            return client.get(analysis_result_key)

        analysis_data_json = execute_redis_operation(
            _get_analysis_result,
            f"get_analysis_result({job_id})"
        )

        if not analysis_data_json:
            raise ValueError("Analysis result not found. Please re-analyze video.")

        analysis_data = json.loads(analysis_data_json)
        
        frame_mapping = analysis_data.get("frame_mapping")
        if not frame_mapping:
            raise ValueError("Frame mapping not found in analysis result")
            
        # 2. Locate paths
        captures_dir = job_dir / "captures"
        if not captures_dir.exists():
             raise ValueError("No captures found. Please upload images first.")
             
        # Find original video
        original_video = job_dir / "original.mp4"
        if not original_video.exists():
            original_video = job_dir / "original.gif"
        
        if not original_video.exists():
             raise ValueError("Original video file missing")
             
        # Output info
        output_dir = file_service.get_output_directory(job_id)
        final_video_path = output_dir / "final.mp4"
        
        # 3.Run Composition
        update_gen_status("processing", 20, "Composing video sequence...")
        
        success = video_composer.compose_video(
            job_id=job_id,
            captures_dir=captures_dir,
            frame_mapping=frame_mapping,
            original_video_path=original_video,
            output_path=final_video_path,
            fps=fps
        )
        
        if not success:
            raise RuntimeError("Video composition failed")
            
        # 4. Finish
        final_url = f"/outputs/{job_id}/final.mp4"
        update_gen_status("completed", 100, "Video generated successfully", final_url)
        
        return {"status": "completed", "url": final_url}

    except Exception as e:
        logger.error(f"[{job_id}] Generation task failed: {e}", exc_info=True)
        update_gen_status("failed", 0, str(e))
        raise
