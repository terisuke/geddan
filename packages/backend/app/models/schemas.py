"""
Pydantic schemas for request/response models
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, timezone


class UploadResponse(BaseModel):
    """Response model for video upload"""

    job_id: str = Field(..., description="Unique job identifier (UUID)")
    status: str = Field(default="processing", description="Job status")
    message: str = Field(..., description="Human-readable status message")
    filename: str = Field(..., description="Original filename")
    size: int = Field(..., description="File size in bytes")
    content_type: str = Field(..., description="MIME type")
    created_at: Optional[datetime] = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Upload timestamp (UTC)",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "job_id": "550e8400-e29b-41d4-a716-446655440000",
                "status": "processing",
                "message": "Video uploaded successfully. Analysis will begin shortly.",
                "filename": "dance.mp4",
                "size": 15728640,
                "content_type": "video/mp4",
                "created_at": "2025-11-16T12:00:00Z",
            }
        }


class ErrorResponse(BaseModel):
    """Error response model"""

    detail: str = Field(..., description="Error message")

    class Config:
        json_schema_extra = {
            "example": {"detail": "Only MP4 and GIF files are allowed"}
        }


class ClusterInfo(BaseModel):
    """Cluster information model for pHash clustering results"""

    id: int = Field(..., description="Cluster ID (0-indexed)")
    size: int = Field(..., ge=1, description="Number of frames in this cluster")
    thumbnail_url: str = Field(..., description="URL path to cluster representative thumbnail")

    class Config:
        json_schema_extra = {
            "example": {
                "id": 0,
                "size": 12,
                "thumbnail_url": "/outputs/550e8400-e29b-41d4-a716-446655440000/thumbnails/cluster-0.jpg",
            }
        }


class AnalysisResult(BaseModel):
    """Analysis result model containing cluster information"""

    clusters: List[ClusterInfo] = Field(default_factory=list, description="List of clusters with representative thumbnails")
    frame_mapping: Dict[int, int] = Field(default_factory=dict, description="Mapping from frame index to cluster ID")

    class Config:
        json_schema_extra = {
            "example": {
                "clusters": [
                    {
                        "id": 0,
                        "size": 12,
                        "thumbnail_url": "/outputs/550e8400-e29b-41d4-a716-446655440000/thumbnails/cluster-0.jpg",
                    },
                    {
                        "id": 1,
                        "size": 8,
                        "thumbnail_url": "/outputs/550e8400-e29b-41d4-a716-446655440000/thumbnails/cluster-1.jpg",
                    },
                ]
            }
        }


class AnalysisStatus(BaseModel):
    """Analysis job status response"""

    job_id: str
    status: str = Field(..., description="processing | completed | failed | pending")
    progress: int = Field(0, ge=0, le=100, description="Progress percentage")
    current_step: Optional[str] = Field(None, description="Current processing step")
    error: Optional[str] = Field(None, description="Error message if failed")
    result: Optional[AnalysisResult] = Field(None, description="Analysis result if completed")

    class Config:
        json_schema_extra = {
            "example": {
                "job_id": "550e8400-e29b-41d4-a716-446655440000",
                "status": "processing",
                "progress": 45,
                "current_step": "Detecting poses...",
                "result": None,
            }
        }
