"""
Tests for video upload API endpoint
"""

import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_upload_rules_endpoint(client: AsyncClient):
    """Test GET /api/upload/rules returns validation rules"""
    response = await client.get("/api/upload/rules")
    assert response.status_code == 200

    data = response.json()
    assert "max_file_size_mb" in data
    assert "allowed_types" in data
    assert "allowed_extensions" in data
    assert data["max_file_size_mb"] == 100
    assert "video/mp4" in data["allowed_types"]
    assert "image/gif" in data["allowed_types"]


@pytest.mark.anyio
async def test_upload_mp4_success(client: AsyncClient, sample_mp4_file):
    """Test successful MP4 upload"""
    filename, content, content_type = sample_mp4_file

    response = await client.post(
        "/api/upload", files={"file": (filename, content, content_type)}
    )

    assert response.status_code == 200
    data = response.json()

    # Verify response structure
    assert "job_id" in data
    assert "status" in data
    assert "message" in data
    assert "filename" in data
    assert "size" in data
    assert "content_type" in data

    # Verify values
    # Status can be "processing" (with Redis/Celery) or "pending" (without)
    assert data["status"] in ["processing", "pending"]
    assert data["filename"] == filename
    assert data["content_type"] == content_type
    assert data["size"] > 0
    assert len(data["job_id"]) == 36  # UUID length


@pytest.mark.anyio
async def test_upload_gif_success(client: AsyncClient, sample_gif_file):
    """Test successful GIF upload"""
    filename, content, content_type = sample_gif_file

    response = await client.post(
        "/api/upload", files={"file": (filename, content, content_type)}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["content_type"] == "image/gif"


@pytest.mark.anyio
async def test_upload_file_too_large(client: AsyncClient, large_file):
    """Test rejection of oversized file (>100MB)"""
    filename, content, content_type = large_file

    response = await client.post(
        "/api/upload", files={"file": (filename, content, content_type)}
    )

    assert response.status_code == 413  # Payload Too Large
    data = response.json()
    assert "detail" in data
    assert "100MB" in data["detail"] or "size" in data["detail"].lower()


@pytest.mark.anyio
async def test_upload_invalid_content_type(client: AsyncClient, invalid_file):
    """Test rejection of invalid content type (not MP4/GIF)"""
    filename, content, content_type = invalid_file

    response = await client.post(
        "/api/upload", files={"file": (filename, content, content_type)}
    )

    assert response.status_code == 400  # Bad Request
    data = response.json()
    assert "detail" in data
    assert "MP4" in data["detail"] or "GIF" in data["detail"]


@pytest.mark.anyio
async def test_upload_no_file(client: AsyncClient):
    """Test error when no file is provided"""
    response = await client.post("/api/upload")

    assert response.status_code == 422  # Unprocessable Entity
    data = response.json()
    assert "detail" in data


@pytest.mark.anyio
async def test_upload_empty_file(client: AsyncClient):
    """Test rejection of empty file"""
    response = await client.post(
        "/api/upload", files={"file": ("empty.mp4", b"", "video/mp4")}
    )

    assert response.status_code == 400  # Bad Request
    data = response.json()
    assert "detail" in data
    assert "empty" in data["detail"].lower()


@pytest.mark.anyio
async def test_upload_wrong_extension(client: AsyncClient):
    """Test rejection of file with wrong extension"""
    content = b"\x00\x00\x00\x1c\x66\x74\x79\x70" + b"x" * 1000

    response = await client.post(
        "/api/upload", files={"file": ("video.avi", content, "video/mp4")}
    )

    assert response.status_code == 400  # Bad Request
    data = response.json()
    assert "detail" in data
    assert "extension" in data["detail"].lower() or "mp4" in data["detail"].lower()


@pytest.mark.anyio
async def test_upload_creates_unique_job_ids(client: AsyncClient, sample_mp4_file):
    """Test that multiple uploads create unique job IDs"""
    filename, content, content_type = sample_mp4_file

    # Upload same file twice
    response1 = await client.post(
        "/api/upload", files={"file": (filename, content, content_type)}
    )
    response2 = await client.post(
        "/api/upload", files={"file": (filename, content, content_type)}
    )

    assert response1.status_code == 200
    assert response2.status_code == 200

    job_id1 = response1.json()["job_id"]
    job_id2 = response2.json()["job_id"]

    # Job IDs must be different
    assert job_id1 != job_id2
