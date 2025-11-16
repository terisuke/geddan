"""
Resource cleanup tasks

Automatically clean up old job directories and outputs after retention period.
"""

import logging
import shutil
from pathlib import Path
from datetime import datetime, timezone, timedelta
import os

from app.celery_worker import celery_app

logger = logging.getLogger(__name__)

# Get retention period from environment (default: 24 hours)
RETENTION_HOURS = int(os.getenv("FILE_RETENTION_HOURS", "24"))


@celery_app.task(name="tasks.cleanup_old_jobs")
def cleanup_old_jobs() -> dict:
    """
    Clean up job directories older than retention period

    Removes:
    - uploads/{job_id}/ directories
    - outputs/{job_id}/ directories

    Returns:
        Dictionary with cleanup statistics
    """
    logger.info(f"Starting cleanup task (retention: {RETENTION_HOURS} hours)")

    retention_delta = timedelta(hours=RETENTION_HOURS)
    cutoff_time = datetime.now(timezone.utc) - retention_delta

    stats = {
        "uploads_removed": 0,
        "outputs_removed": 0,
        "errors": 0,
        "bytes_freed": 0,
    }

    # Clean uploads directory
    uploads_dir = Path("uploads")
    if uploads_dir.exists():
        stats.update(_cleanup_directory(uploads_dir, cutoff_time, "uploads"))

    # Clean outputs directory
    outputs_dir = Path("outputs")
    if outputs_dir.exists():
        output_stats = _cleanup_directory(outputs_dir, cutoff_time, "outputs")
        stats["outputs_removed"] = output_stats.get("uploads_removed", 0)
        stats["errors"] += output_stats.get("errors", 0)
        stats["bytes_freed"] += output_stats.get("bytes_freed", 0)

    logger.info(
        f"Cleanup complete: {stats['uploads_removed']} uploads, "
        f"{stats['outputs_removed']} outputs removed, "
        f"{stats['bytes_freed'] / 1024 / 1024:.2f} MB freed"
    )

    return stats


def _cleanup_directory(base_dir: Path, cutoff_time: datetime, dir_type: str) -> dict:
    """
    Helper function to clean up a directory

    Args:
        base_dir: Base directory to clean (uploads or outputs)
        cutoff_time: Remove directories older than this time
        dir_type: Directory type for logging ("uploads" or "outputs")

    Returns:
        Dictionary with cleanup statistics
    """
    stats = {"uploads_removed": 0, "errors": 0, "bytes_freed": 0}

    for job_dir in base_dir.iterdir():
        if not job_dir.is_dir():
            continue

        try:
            # Get directory modification time
            mtime = datetime.fromtimestamp(job_dir.stat().st_mtime, tz=timezone.utc)

            if mtime < cutoff_time:
                # Calculate directory size before deletion
                dir_size = sum(
                    f.stat().st_size
                    for f in job_dir.rglob("*")
                    if f.is_file()
                )

                # Remove directory
                shutil.rmtree(job_dir)

                stats["uploads_removed"] += 1
                stats["bytes_freed"] += dir_size

                logger.info(
                    f"Removed {dir_type}/{job_dir.name} "
                    f"(age: {datetime.now(timezone.utc) - mtime}, "
                    f"size: {dir_size / 1024 / 1024:.2f} MB)"
                )

        except Exception as e:
            logger.error(f"Failed to remove {dir_type}/{job_dir.name}: {e}")
            stats["errors"] += 1

    return stats


@celery_app.task(name="tasks.cleanup_job")
def cleanup_job(job_id: str) -> bool:
    """
    Clean up a specific job immediately

    Args:
        job_id: Job ID to clean up

    Returns:
        True if successful, False otherwise
    """
    logger.info(f"Cleaning up job {job_id}")

    success = True

    # Remove uploads directory
    uploads_dir = Path("uploads") / job_id
    if uploads_dir.exists():
        try:
            shutil.rmtree(uploads_dir)
            logger.info(f"Removed uploads/{job_id}")
        except Exception as e:
            logger.error(f"Failed to remove uploads/{job_id}: {e}")
            success = False

    # Remove outputs directory
    outputs_dir = Path("outputs") / job_id
    if outputs_dir.exists():
        try:
            shutil.rmtree(outputs_dir)
            logger.info(f"Removed outputs/{job_id}")
        except Exception as e:
            logger.error(f"Failed to remove outputs/{job_id}: {e}")
            success = False

    return success


# Periodic task configuration (runs daily at 3 AM)
# Uncomment to enable:
#
# from celery.schedules import crontab
#
# celery_app.conf.beat_schedule = {
#     'cleanup-old-jobs': {
#         'task': 'tasks.cleanup_old_jobs',
#         'schedule': crontab(hour=3, minute=0),  # Daily at 3 AM
#     },
# }
