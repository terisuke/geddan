"""
Tests for video analysis status API endpoint
"""

import pytest
import json
from httpx import AsyncClient
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.anyio
async def test_analyze_nonexistent_job(client: AsyncClient):
    """Test GET /api/analyze/{job_id} with non-existent job returns 404"""
    response = await client.get("/api/analyze/nonexistent-job-id")
    assert response.status_code == 404

    data = response.json()
    assert "detail" in data


@pytest.mark.anyio
async def test_analyze_job_pending_no_redis(client: AsyncClient):
    """Test analysis status when Redis is not available"""
    # Create a job ID that doesn't exist in Redis
    job_id = "test-job-no-redis"

    response = await client.get(f"/api/analyze/{job_id}")

    # Should return 404 when job doesn't exist in Redis
    assert response.status_code == 404


@pytest.mark.anyio
async def test_analyze_job_processing(client: AsyncClient, tmp_path):
    """Test analysis status when job is processing"""
    from unittest.mock import patch, MagicMock, AsyncMock
    from pathlib import Path

    job_id = "test-job-processing"

    # Create mock job directory with original file
    job_dir = tmp_path / job_id
    job_dir.mkdir(parents=True)
    (job_dir / "original.mp4").touch()

    # Mock file_service.get_job_directory
    mock_file_service = MagicMock()
    mock_file_service.get_job_directory = MagicMock(return_value=job_dir)

    # Mock Redis client (async methods)
    mock_redis = MagicMock()
    mock_redis.hgetall = AsyncMock(return_value={
        "status": "processing",
        "progress": "50",
        "current_step": "Computing hashes...",
        "error": ""
    })

    with patch("app.routers.analyze.file_service", mock_file_service), \
         patch("app.routers.analyze.get_redis_client", return_value=mock_redis):
        response = await client.get(f"/api/analyze/{job_id}")

    assert response.status_code == 200
    data = response.json()

    assert data["job_id"] == job_id
    assert data["status"] == "processing"
    assert data["progress"] == 50
    assert data["current_step"] == "Computing hashes..."
    assert data["result"] is None


@pytest.mark.anyio
async def test_analyze_job_completed_with_result(client: AsyncClient, tmp_path):
    """Test analysis status when job is completed with clusters"""
    from unittest.mock import patch, MagicMock, AsyncMock

    job_id = "test-job-completed"

    # Create mock job directory with original file
    job_dir = tmp_path / job_id
    job_dir.mkdir(parents=True)
    (job_dir / "original.mp4").touch()

    # Mock file_service.get_job_directory
    mock_file_service = MagicMock()
    mock_file_service.get_job_directory = MagicMock(return_value=job_dir)

    # Mock Redis client (async methods)
    mock_redis = MagicMock()
    mock_redis.hgetall = AsyncMock(return_value={
        "status": "completed",
        "progress": "100",
        "current_step": "Analysis completed successfully",
        "error": ""
    })

    # Mock result data
    result_data = {
        "clusters": [
            {"id": 0, "size": 5, "thumbnail_url": f"/outputs/{job_id}/thumbnails/cluster-0.jpg"},
            {"id": 1, "size": 3, "thumbnail_url": f"/outputs/{job_id}/thumbnails/cluster-1.jpg"},
        ]
    }
    mock_redis.get = AsyncMock(return_value=json.dumps(result_data))

    with patch("app.routers.analyze.file_service", mock_file_service), \
         patch("app.routers.analyze.get_redis_client", return_value=mock_redis):
        response = await client.get(f"/api/analyze/{job_id}")

    assert response.status_code == 200
    data = response.json()

    assert data["job_id"] == job_id
    assert data["status"] == "completed"
    assert data["progress"] == 100
    assert data["result"] is not None
    assert "clusters" in data["result"]
    assert len(data["result"]["clusters"]) == 2
    assert data["result"]["clusters"][0]["id"] == 0
    assert data["result"]["clusters"][0]["size"] == 5
    assert data["result"]["clusters"][0]["thumbnail_url"].startswith(f"/outputs/{job_id}/")


@pytest.mark.anyio
async def test_analyze_job_failed(client: AsyncClient, tmp_path):
    """Test analysis status when job failed"""
    from unittest.mock import patch, MagicMock, AsyncMock

    job_id = "test-job-failed"

    # Create mock job directory with original file
    job_dir = tmp_path / job_id
    job_dir.mkdir(parents=True)
    (job_dir / "original.mp4").touch()

    # Mock file_service.get_job_directory
    mock_file_service = MagicMock()
    mock_file_service.get_job_directory = MagicMock(return_value=job_dir)

    # Mock Redis client (async methods)
    mock_redis = MagicMock()
    mock_redis.hgetall = AsyncMock(return_value={
        "status": "failed",
        "progress": "0",
        "current_step": "",
        "error": "FFmpeg extraction failed: Invalid video format"
    })

    with patch("app.routers.analyze.file_service", mock_file_service), \
         patch("app.routers.analyze.get_redis_client", return_value=mock_redis):
        response = await client.get(f"/api/analyze/{job_id}")

    assert response.status_code == 200
    data = response.json()

    assert data["job_id"] == job_id
    assert data["status"] == "failed"
    assert data["progress"] == 0
    assert "FFmpeg extraction failed" in data["error"]
    assert data["result"] is None


@pytest.mark.anyio
async def test_analyze_job_completed_no_result_data(client: AsyncClient, tmp_path):
    """Test completed status when result data is missing in Redis"""
    from unittest.mock import patch, MagicMock, AsyncMock

    job_id = "test-job-no-result"

    # Create mock job directory with original file
    job_dir = tmp_path / job_id
    job_dir.mkdir(parents=True)
    (job_dir / "original.mp4").touch()

    # Mock file_service.get_job_directory
    mock_file_service = MagicMock()
    mock_file_service.get_job_directory = MagicMock(return_value=job_dir)

    # Mock Redis client (async methods)
    mock_redis = MagicMock()
    mock_redis.hgetall = AsyncMock(return_value={
        "status": "completed",
        "progress": "100",
        "current_step": "Analysis completed",
        "error": ""
    })
    mock_redis.get = AsyncMock(return_value=None)  # No result data

    with patch("app.routers.analyze.file_service", mock_file_service), \
         patch("app.routers.analyze.get_redis_client", return_value=mock_redis):
        response = await client.get(f"/api/analyze/{job_id}")

    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "completed"
    assert data["result"] is None  # No result data available


@pytest.mark.anyio
async def test_analyze_redis_connection_error(client: AsyncClient):
    """Test behavior when Redis connection fails"""
    from unittest.mock import patch

    job_id = "test-job-redis-error"

    # Mock Redis client to raise error
    def mock_get_redis_error():
        raise ConnectionError("Redis connection failed")

    with patch("app.routers.analyze.get_redis_client", side_effect=mock_get_redis_error):
        response = await client.get(f"/api/analyze/{job_id}")

    # Should return 404 or 500 depending on error handling
    assert response.status_code in [404, 500]
