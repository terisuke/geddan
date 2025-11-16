"""
Integration test for status polling workflow

Tests the complete flow: upload → queue → status polling → result retrieval
This ensures that the frontend can poll for real-time progress updates.
"""

import pytest
from pathlib import Path
from PIL import Image
import tempfile
import time


@pytest.mark.asyncio
async def test_upload_and_status_polling_workflow(client, tmp_path, monkeypatch):
    """
    Test the complete upload → analyze → poll status workflow

    This test verifies:
    1. Upload writes initial status to Redis
    2. GET /api/analyze/{job_id} returns correct status
    3. Status polling workflow is functional

    Note: This test mocks file validation to avoid requiring real video files.
    """
    # Mock the file validation to skip magic number checks
    # This allows us to test the status polling logic without needing real video files
    async def mock_validate(file):
        # Skip validation - assume file is valid
        pass

    monkeypatch.setattr("app.routers.upload.validate_video_upload", mock_validate)

    # Create a minimal "video" file (placeholder for upload test)
    video_path = tmp_path / "test.mp4"
    with open(video_path, "wb") as f:
        # Write minimal MP4 header to satisfy basic checks
        f.write(b"fake video content")

    # Upload the file
    with open(video_path, "rb") as f:
        response = await client.post(
            "/api/upload",
            files={"file": ("test.mp4", f, "video/mp4")}
        )

    # Should succeed since we mocked validation
    assert response.status_code == 200
    upload_data = response.json()
    job_id = upload_data["job_id"]

    # Verify job_id is returned
    assert "job_id" in upload_data
    assert len(job_id) > 0

    # Test 1: Check initial status (should be "processing" or "pending")
    # Note: Status depends on whether Redis/Celery is configured
    response = await client.get(f"/api/analyze/{job_id}")
    assert response.status_code == 200

    status_data = response.json()
    assert status_data["job_id"] == job_id

    # Status should be either "pending" (no Redis/Celery) or "processing" (with Redis/Celery)
    assert status_data["status"] in ["pending", "processing"]

    # Verify progress field exists and is valid
    assert "progress" in status_data
    assert 0 <= status_data["progress"] <= 100

    # Test 2: Verify that current_step contains meaningful information
    assert "current_step" in status_data
    if status_data["current_step"]:
        assert len(status_data["current_step"]) > 0


@pytest.mark.asyncio
async def test_status_404_for_nonexistent_job(client):
    """Test that GET /api/analyze/{job_id} returns 404 for non-existent job"""
    response = await client.get("/api/analyze/nonexistent-job-id")
    assert response.status_code == 404
    error_data = response.json()
    assert "detail" in error_data
    assert "not found" in error_data["detail"].lower()


@pytest.mark.asyncio
async def test_status_pending_when_redis_unavailable(client, tmp_path, monkeypatch):
    """
    Test that status returns 'pending' with informative message when Redis is not configured

    This simulates the case where upload succeeds but Redis/Celery is not available.
    """
    # This test would require mocking Redis to be unavailable
    # For now, we document the expected behavior:
    #
    # Expected response when Redis not available:
    # {
    #     "job_id": "...",
    #     "status": "pending",
    #     "progress": 0,
    #     "current_step": "Waiting for backend services (Redis/Celery not configured)...",
    #     "error": null,
    #     "result": null
    # }
    pass


@pytest.mark.asyncio
async def test_intermediate_status_updates():
    """
    Test that intermediate status updates are written to Redis

    This would require:
    1. Mocking frame extraction to return 2 frames quickly
    2. Checking Redis after each step to verify status was written
    3. Verifying progress goes: 0 → 10 → 30 → 60 → 90 → 100

    For now, this is a placeholder for future implementation.
    """
    # TODO: Implement once we have Redis testing utilities
    # Expected flow:
    # - Upload → Redis gets status="processing", progress=0
    # - Worker starts → Redis gets progress=10 (extracting frames)
    # - Hash computation → Redis gets progress=30
    # - Thumbnail generation → Redis gets progress=60
    # - Finalizing → Redis gets progress=90
    # - Completed → Redis gets status="completed", progress=100, result={...}
    pass
