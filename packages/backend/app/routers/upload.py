"""
Upload router for handling video file uploads
"""

from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import JSONResponse
from app.models.schemas import UploadResponse, ErrorResponse
from app.services.file_service import file_service
from app.utils.validators import validate_video_upload, get_validation_rules
import logging
from datetime import datetime, timezone
import os

logger = logging.getLogger(__name__)


def get_celery_app():
    """Get Celery app if available"""
    try:
        from app.celery_worker import celery_app
        return celery_app
    except ImportError:
        return None


def get_redis_client():
    """Get Redis client if available"""
    try:
        from app.main import redis_client
        return redis_client
    except ImportError:
        return None

router = APIRouter(prefix="/api", tags=["upload"])


@router.get("/upload/rules", response_model=dict)
async def get_upload_rules():
    """
    Get file upload validation rules

    Returns validation constraints for client-side validation:
    - Maximum file size
    - Allowed content types
    - Allowed file extensions
    """
    return get_validation_rules()


@router.post(
    "/upload",
    response_model=UploadResponse,
    responses={
        200: {"model": UploadResponse, "description": "File uploaded successfully"},
        400: {
            "model": ErrorResponse,
            "description": "Invalid file type or extension",
        },
        413: {
            "model": ErrorResponse,
            "description": "File size exceeds 100MB limit",
        },
        422: {
            "model": ErrorResponse,
            "description": "No file provided or validation error",
        },
    },
    summary="Upload video file for analysis",
    description="""
    Upload a video file (MP4 or GIF) for pose analysis.

    **Constraints:**
    - File size: Max 100MB
    - Formats: MP4, GIF only
    - The file will be queued for AI analysis

    **Returns:**
    - job_id: Use this to check analysis status at GET /api/analyze/{job_id}
    - status: Initial status will be 'processing'
    """,
)
async def upload_video(
    file: UploadFile = File(..., description="Video file (MP4 or GIF, max 100MB)"),
) -> UploadResponse:
    """
    Upload video file and initiate analysis

    The video will be:
    1. Validated (type, size, extension)
    2. Saved to disk with unique job ID
    3. Queued for background analysis (future: Celery task)
    4. Return job_id for status polling

    Args:
        file: Video file (validated by dependency)

    Returns:
        UploadResponse with job_id and status
    """
    try:
        # Validate file
        await validate_video_upload(file)

        # Generate unique job ID
        job_id = file_service.generate_job_id()

        logger.info(
            f"Starting upload for job {job_id}: {file.filename} ({file.content_type})"
        )

        # Save file to disk
        file_path, file_size = await file_service.save_upload(file, job_id)

        logger.info(
            f"Uploaded file saved: {file_path} ({file_size} bytes) for job {job_id}"
        )

        # Queue Celery task for video analysis (if available)
        celery_app = get_celery_app()
        redis_client = get_redis_client()

        message = "Video uploaded successfully."

        if celery_app and redis_client:
            try:
                # Write initial status to Redis before queuing task
                # This ensures frontend polling gets "processing" status immediately
                job_status_key = f"job:{job_id}:state"
                await redis_client.hset(
                    job_status_key,
                    mapping={
                        "status": "processing",
                        "progress": "0",
                        "current_step": "Video uploaded, queued for analysis...",
                        "error": "",
                    }
                )
                await redis_client.expire(job_status_key, 86400)  # 24h TTL

                # Import task here to avoid circular imports
                from app.tasks.analyze_video import analyze_video_task

                # Queue task for analysis
                task = analyze_video_task.delay(job_id, str(file_path))

                logger.info(f"Job {job_id} queued for analysis: task_id={task.id}")
                message = "Video uploaded successfully. Analysis will begin shortly."

            except Exception as e:
                logger.error(f"Failed to queue Celery task for {job_id}: {e}")
                message = "Video uploaded successfully, but analysis queue is unavailable."

        elif not redis_client:
            logger.warning(f"Job {job_id}: Redis not available, Celery task not queued")
            message = "Video uploaded successfully. Analysis requires Redis/Celery (not configured)."

        else:
            logger.warning(f"Job {job_id}: Celery not configured, task not queued")
            message = "Video uploaded successfully. Analysis will be processed when worker is available."

        # Return response
        response = UploadResponse(
            job_id=job_id,
            status="processing" if (celery_app and redis_client) else "pending",
            message=message,
            filename=file.filename or "unknown",
            size=file_size,
            content_type=file.content_type or "application/octet-stream",
            created_at=datetime.now(timezone.utc),
        )

        return response

    except Exception as e:
        logger.error(f"Upload failed: {e}", exc_info=True)
        # Re-raise for FastAPI's exception handler
        raise
