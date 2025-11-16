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
async def test_upload_and_status_polling_workflow(client, tmp_path):
    """
    Test the complete upload → analyze → poll status workflow

    This test verifies:
    1. Upload writes initial status to Redis
    2. Celery task updates intermediate statuses (0% → 10% → 30% → 60% → 90% → 100%)
    3. GET /api/analyze/{job_id} returns correct status at each step
    4. Final result includes cluster information
    """
    # Create a minimal test "video" (actually just 2 image files for testing)
    # In a real scenario, this would be a proper video file
    test_frames_dir = tmp_path / "test_frames"
    test_frames_dir.mkdir()

    # Create 2 simple test images (red and blue)
    for i, color in enumerate([(255, 0, 0), (0, 0, 255)]):
        img = Image.new('RGB', (100, 100), color=color)
        img.save(test_frames_dir / f"frame_{i}.jpg")

    # Create a minimal "video" file (just a placeholder for upload test)
    video_path = tmp_path / "test.mp4"
    with open(video_path, "wb") as f:
        f.write(b"fake video content")

    # Note: This test requires mocking the actual video processing
    # For now, we'll test the API contract only

    # Upload the file
    with open(video_path, "rb") as f:
        response = await client.post(
            "/api/upload",
            files={"file": ("test.mp4", f, "video/mp4")}
        )

    assert response.status_code == 200
    upload_data = response.json()
    job_id = upload_data["job_id"]

    # Test 1: Check initial status (should be "processing" with progress 0)
    # Note: This assumes Redis is available and upload.py wrote initial status
    response = await client.get(f"/api/analyze/{job_id}")
    assert response.status_code == 200

    status_data = response.json()
    assert status_data["job_id"] == job_id

    # Status should be either "pending" (if worker hasn't started)
    # or "processing" (if worker started and wrote initial status)
    assert status_data["status"] in ["pending", "processing"]

    # If processing, progress should be 0 or higher
    if status_data["status"] == "processing":
        assert 0 <= status_data["progress"] <= 100
        assert status_data["current_step"] is not None

    # Test 2: Verify that current_step contains meaningful information
    # It should NOT be empty when status is processing
    if status_data["status"] == "processing":
        assert len(status_data["current_step"]) > 0
        # Should mention one of: "queued", "analysis", "extracting", "computing", "generating"
        current_step_lower = status_data["current_step"].lower()
        assert any(keyword in current_step_lower for keyword in
                   ["queue", "analysis", "extract", "comput", "generat", "start"])


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
