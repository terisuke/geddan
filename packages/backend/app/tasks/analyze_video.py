"""
Celery task for video analysis

Pipeline:
1. Extract frames from video at 1fps (frame_extractor)
2. Compute perceptual hashes (hash_analyzer)
3. Cluster similar frames
4. Generate thumbnails for cluster representatives
5. Store results in Redis
"""

import logging
import shutil
from pathlib import Path
from typing import Dict, List, Optional
import redis
import json
import os
import time

from app.celery_worker import celery_app
from app.services.frame_extractor import frame_extractor
from app.services.hash_analyzer import hash_analyzer
from app.services.file_service import file_service

logger = logging.getLogger(__name__)


def get_redis_client() -> Optional[redis.Redis]:
    """Get synchronous Redis client for storing job status in Celery tasks"""
    try:
        redis_url = os.getenv("REDIS_URL")
        if not redis_url:
            redis_host = os.getenv("REDIS_HOST", "localhost")
            redis_port = os.getenv("REDIS_PORT", "6379")
            redis_url = f"redis://{redis_host}:{redis_port}/0"

        # Use synchronous Redis client for Celery tasks
        return redis.from_url(redis_url, encoding="utf-8", decode_responses=True)
    except Exception as e:
        logger.warning(f"Failed to connect to Redis: {e}")
        return None


def update_job_status(
    job_id: str,
    status: str,
    progress: int,
    current_step: str = "",
    error: str = ""
) -> None:
    """
    Update job status in Redis for frontend polling

    This function writes to Redis independently of Celery's update_state(),
    ensuring that the frontend can poll for real-time progress updates.

    Args:
        job_id: Unique job identifier
        status: Job status (processing | completed | failed | pending)
        progress: Progress percentage (0-100)
        current_step: Human-readable current step description
        error: Error message (if failed)
    """
    redis_client = get_redis_client()
    if not redis_client:
        logger.warning(f"[{job_id}] Redis not available, cannot update job status")
        return

    try:
        job_status_key = f"job:{job_id}:state"

        redis_client.hset(
            job_status_key,
            mapping={
                "status": status,
                "progress": str(progress),
                "current_step": current_step,
                "error": error,
            }
        )

        # Set 24h TTL on the status key
        redis_client.expire(job_status_key, 86400)

        logger.debug(f"[{job_id}] Updated Redis status: {status} ({progress}%) - {current_step}")

    except Exception as e:
        logger.warning(f"[{job_id}] Failed to update status in Redis: {e}")


@celery_app.task(bind=True, name="tasks.analyze_video")
def analyze_video_task(self, job_id: str, video_path: str) -> Dict:
    """
    Analyze video: extract frames, compute hashes, cluster, generate thumbnails

    Args:
        self: Celery task instance (bound)
        job_id: Unique job identifier
        video_path: Path to uploaded video file

    Returns:
        Dictionary with analysis results (clusters, thumbnails)

    Raises:
        Exception: If analysis fails at any step
    """
    video_path = Path(video_path)
    job_dir = file_service.get_job_directory(job_id)

    # Track timing metrics
    start_time = time.time()
    step_times = {}

    logger.info(f"Starting video analysis for job {job_id}")

    try:
        # Update status: Starting
        # Note: We update both Celery state (for worker monitoring) and Redis (for frontend polling)
        self.update_state(
            state="PROGRESS",
            meta={
                "job_id": job_id,
                "status": "processing",
                "progress": 0,
                "current_step": "Starting video analysis...",
            }
        )
        update_job_status(job_id, "processing", 0, "Starting video analysis...")

        # Step 1: Extract frames at 1fps
        step_start = time.time()
        logger.info(f"[{job_id}] Step 1/4: Extracting frames")
        self.update_state(
            state="PROGRESS",
            meta={
                "job_id": job_id,
                "status": "processing",
                "progress": 10,
                "current_step": "Extracting frames from video (1fps)...",
            }
        )
        update_job_status(job_id, "processing", 10, "Extracting frames from video (1fps)...")

        frames_dir = job_dir / "frames"
        frames_dir.mkdir(exist_ok=True)

        frame_paths = frame_extractor.extract_frames(
            video_path=video_path,
            output_dir=frames_dir,
            fps=1.0,  # 1 frame per second
        )

        step_times["frame_extraction"] = time.time() - step_start
        logger.info(
            f"[{job_id}] Extracted {len(frame_paths)} frames "
            f"in {step_times['frame_extraction']:.2f}s"
        )

        # Step 2: Compute perceptual hashes and cluster
        step_start = time.time()
        logger.info(f"[{job_id}] Step 2/4: Computing perceptual hashes")
        self.update_state(
            state="PROGRESS",
            meta={
                "job_id": job_id,
                "status": "processing",
                "progress": 30,
                "current_step": "Computing perceptual hashes (pHash)...",
            }
        )
        update_job_status(job_id, "processing", 30, "Computing perceptual hashes (pHash)...")

        # Analyze frames: compute hashes, cluster, select representatives
        representatives = hash_analyzer.analyze(frame_paths)

        step_times["hashing_clustering"] = time.time() - step_start
        logger.info(
            f"[{job_id}] Found {len(representatives)} unique clusters "
            f"in {step_times['hashing_clustering']:.2f}s"
        )

        # Step 3: Generate thumbnails
        step_start = time.time()
        logger.info(f"[{job_id}] Step 3/4: Generating thumbnails")
        self.update_state(
            state="PROGRESS",
            meta={
                "job_id": job_id,
                "status": "processing",
                "progress": 60,
                "current_step": f"Generating thumbnails ({len(representatives)} clusters)...",
            }
        )
        update_job_status(job_id, "processing", 60, f"Generating thumbnails ({len(representatives)} clusters)...")

        thumbnails_dir = job_dir / "thumbnails"
        thumbnails_dir.mkdir(exist_ok=True)

        clusters = []

        for cluster_id, representative_path, cluster_size in representatives:
            # Copy representative frame as thumbnail
            thumbnail_filename = f"cluster-{cluster_id}.jpg"
            thumbnail_path = thumbnails_dir / thumbnail_filename

            shutil.copy2(representative_path, thumbnail_path)

            # Generate URL for frontend
            thumbnail_url = f"/outputs/{job_id}/thumbnails/{thumbnail_filename}"

            clusters.append({
                "id": cluster_id,
                "size": cluster_size,
                "thumbnail_url": thumbnail_url,
            })

            logger.debug(
                f"[{job_id}] Cluster {cluster_id}: {cluster_size} frames, "
                f"thumbnail: {thumbnail_filename}"
            )

        step_times["thumbnail_generation"] = time.time() - step_start
        logger.info(
            f"[{job_id}] Generated {len(clusters)} thumbnails "
            f"in {step_times['thumbnail_generation']:.2f}s"
        )

        # Step 4: Store results in Redis
        step_start = time.time()
        logger.info(f"[{job_id}] Step 4/4: Storing results")
        self.update_state(
            state="PROGRESS",
            meta={
                "job_id": job_id,
                "status": "processing",
                "progress": 90,
                "current_step": "Finalizing analysis results...",
            }
        )
        update_job_status(job_id, "processing", 90, "Finalizing analysis results...")

        # Prepare result
        result = {
            "clusters": clusters,
        }

        # Store in Redis
        # Update final status to "completed"
        update_job_status(job_id, "completed", 100, "Analysis completed successfully")

        # Store result data
        redis_client = get_redis_client()
        if redis_client:
            try:
                result_key = f"job:{job_id}:result"
                redis_client.setex(result_key, 86400, json.dumps(result))  # 24h TTL

                logger.info(f"[{job_id}] Results stored in Redis")
            except Exception as redis_error:
                logger.warning(f"[{job_id}] Failed to store result in Redis: {redis_error}")
                # Continue anyway - results are saved to filesystem
        else:
            logger.warning(f"[{job_id}] Redis not available, skipping result storage")

        step_times["redis_storage"] = time.time() - step_start

        # Log completion with metrics
        total_time = time.time() - start_time
        logger.info(
            f"[{job_id}] Analysis completed: {len(clusters)} clusters, "
            f"{len(frame_paths)} total frames, "
            f"total time: {total_time:.2f}s"
        )
        logger.info(
            f"[{job_id}] Performance breakdown: "
            f"extraction={step_times['frame_extraction']:.2f}s, "
            f"hashing={step_times['hashing_clustering']:.2f}s, "
            f"thumbnails={step_times['thumbnail_generation']:.2f}s, "
            f"storage={step_times['redis_storage']:.2f}s"
        )

        return result

    except Exception as e:
        logger.error(f"[{job_id}] Analysis failed: {e}", exc_info=True)

        # Update status: Failed
        self.update_state(
            state="FAILURE",
            meta={
                "job_id": job_id,
                "status": "failed",
                "progress": 0,
                "current_step": "",
                "error": str(e),
            }
        )

        # Store failure status in Redis
        update_job_status(job_id, "failed", 0, "", str(e))

        raise
