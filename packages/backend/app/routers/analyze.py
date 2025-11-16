"""
Analysis router for handling video analysis status
"""

from fastapi import APIRouter, HTTPException
from app.models.schemas import AnalysisStatus, AnalysisResult, ErrorResponse
from app.services.file_service import file_service
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["analyze"])

# Get redis_client from main module (set during lifespan)
def get_redis_client() -> Optional[object]:
    """Get Redis client if available"""
    try:
        from app.main import redis_client
        return redis_client
    except ImportError:
        return None


@router.get(
    "/analyze/{job_id}",
    response_model=AnalysisStatus,
    responses={
        200: {"model": AnalysisStatus, "description": "Analysis status retrieved successfully"},
        404: {"model": ErrorResponse, "description": "Job not found"},
    },
    summary="Get analysis status",
    description="""
    Get the current status of a video analysis job.

    **Status values:**
    - `pending`: Job queued, waiting for Celery worker (only when Redis has no status yet)
    - `processing`: Analysis in progress (with real-time progress 0-100%)
    - `completed`: Analysis finished successfully (includes cluster results)
    - `failed`: Analysis failed with error message

    **Progress polling:**
    Frontend should poll this endpoint every 3-5 seconds to get real-time updates.
    The Celery worker writes intermediate status to Redis at each step (0% → 10% → 30% → 60% → 90% → 100%).
    """,
)
async def get_analysis_status(job_id: str) -> AnalysisStatus:
    """
    Get analysis status for a job ID

    Args:
        job_id: Unique job identifier from upload response

    Returns:
        AnalysisStatus with current job status

    Raises:
        404: If job ID does not exist
    """
    try:
        # Check if job directory exists
        job_dir = file_service.get_job_directory(job_id)
        if not job_dir.exists():
            logger.warning(f"Job {job_id} not found")
            raise HTTPException(
                status_code=404,
                detail=f"Job {job_id} not found. Please upload a file first.",
            )

        # Check if original file exists
        original_file = job_dir / "original.mp4"
        if not original_file.exists():
            # Try .gif extension
            original_file = job_dir / "original.gif"
            if not original_file.exists():
                logger.warning(f"Original file not found for job {job_id}")
                raise HTTPException(
                    status_code=404,
                    detail=f"Original file not found for job {job_id}",
                )

        # Get Redis client
        redis_client = get_redis_client()

        # If Redis is available, check for actual job status
        if redis_client:
            try:
                # Check if job status exists in Redis
                job_status_key = f"job:{job_id}:state"
                job_status = await redis_client.hgetall(job_status_key)

                if job_status:
                    # Parse result from Redis if completed
                    result = None
                    if job_status.get("status") == "completed":
                        try:
                            result_key = f"job:{job_id}:result"
                            result_json = await redis_client.get(result_key)
                            if result_json:
                                import json
                                result_data = json.loads(result_json)
                                result = AnalysisResult(**result_data)
                                logger.debug(f"Job {job_id} result loaded: {len(result.clusters)} clusters")
                        except Exception as parse_error:
                            logger.error(f"Failed to parse result for {job_id}: {parse_error}")

                    # Return status from Redis
                    logger.info(f"Job {job_id} status from Redis: {job_status.get('status')}")
                    return AnalysisStatus(
                        job_id=job_id,
                        status=job_status.get("status", "processing"),
                        progress=int(job_status.get("progress", 0)),
                        current_step=job_status.get("current_step"),
                        error=job_status.get("error"),
                        result=result,
                    )
                else:
                    # Job exists but no status in Redis yet - job is pending
                    # Note: "pending" means the job is queued but the worker hasn't started yet.
                    # Once the worker starts, upload.py writes initial status, so this state is brief.
                    logger.info(f"Job {job_id} exists but not yet in queue (Redis available)")
                    return AnalysisStatus(
                        job_id=job_id,
                        status="pending",
                        progress=0,
                        current_step="Job queued, waiting for Celery worker to start processing",
                        error=None,
                        result=None,
                    )
            except Exception as redis_error:
                logger.warning(f"Redis error for job {job_id}: {redis_error}")
                # Fall through to Redis unavailable mode

        # Redis not available - return informative status
        # Note: This "pending" differs from queue-pending above.
        # Here it means "Redis/Celery not configured", so analysis cannot start at all.
        # The current_step message clarifies this for the frontend.
        logger.info(f"Status requested for job {job_id} (Redis not available, analysis cannot run)")

        return AnalysisStatus(
            job_id=job_id,
            status="pending",
            progress=0,
            current_step="Waiting for backend services (Redis/Celery not configured). File uploaded successfully.",
            error=None,
            result=None,
        )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error getting analysis status for {job_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )

