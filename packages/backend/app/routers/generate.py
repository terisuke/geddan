"""
Router for video generation endpoints
"""

from fastapi import APIRouter, File, UploadFile, HTTPException, BackgroundTasks, Form
from fastapi.responses import FileResponse
from typing import List, Optional
import shutil
from pathlib import Path
import logging
import os

from app.services.file_service import file_service
from app.tasks.generate_video import generate_video_task
from app.routers.analyze import get_redis_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["generate"])

@router.post("/generate/{job_id}/capture")
async def upload_capture(
    job_id: str,
    cluster_id: int = Form(...),
    file: UploadFile = File(...)
):
    """
    Upload a captured image for a specific cluster
    """
    try:
        job_dir = file_service.get_job_directory(job_id)
        if not job_dir.exists():
            raise HTTPException(404, "Job not found")
            
        captures_dir = job_dir / "captures"
        captures_dir.mkdir(exist_ok=True)
        
        # Save file as cluster-{id}.png
        # Support png/jpg
        ext = Path(file.filename).suffix
        if not ext:
            ext = ".png"
            
        file_path = captures_dir / f"cluster-{cluster_id}{ext}"
        
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        return {"status": "uploaded", "path": str(file_path)}
        
    except Exception as e:
        logger.error(f"Failed to save capture for job {job_id}: {e}")
        raise HTTPException(500, f"Failed to save capture: {str(e)}")

@router.post("/generate/{job_id}/start")
async def start_generation(job_id: str):
    """
    Start video generation task
    """
    # Check if job exists
    job_dir = file_service.get_job_directory(job_id)
    if not job_dir.exists():
        raise HTTPException(404, "Job not found")

    # Start Celery task
    task = generate_video_task.delay(job_id)
    
    return {"status": "started", "task_id": task.id}

@router.get("/generate/{job_id}/status")
async def get_generation_status(job_id: str):
    """
    Get generation status
    """
    redis_client = get_redis_client()
    if not redis_client:
         return {"status": "unknown", "message": "Redis unavailable"}

    key = f"gen:{job_id}:state"
    data = await redis_client.hgetall(key)

    if not data:
        return {"status": "pending", "progress": 0}

    return data


@router.get("/download/{job_id}/final.mp4")
async def download_final_video(job_id: str):
    """
    Download the generated final video
    """
    output_dir = file_service.get_output_directory(job_id)
    video_path = output_dir / "final.mp4"

    if not video_path.exists():
        raise HTTPException(404, "Video not found. Generation may not be complete.")

    return FileResponse(
        path=str(video_path),
        media_type="video/mp4",
        filename=f"danceframe-{job_id}.mp4",
        headers={
            "Content-Disposition": f'attachment; filename="danceframe-{job_id}.mp4"'
        }
    )
