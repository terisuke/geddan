"""
Tests for file service operations
"""

import pytest
from app.services.file_service import FileService
from pathlib import Path
import tempfile
import shutil


@pytest.fixture
def temp_file_service():
    """Create a file service with temporary directory"""
    temp_dir = tempfile.mkdtemp()
    service = FileService(base_upload_dir=temp_dir)
    yield service
    # Cleanup
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.mark.anyio
async def test_cleanup_job_success(temp_file_service, sample_mp4_file):
    """Test successful job cleanup"""
    # Create a job with a file
    job_id = temp_file_service.generate_job_id()

    # Create mock UploadFile with proper headers
    from io import BytesIO
    from fastapi import UploadFile

    filename, content, content_type = sample_mp4_file
    file = UploadFile(
        filename=filename,
        file=BytesIO(content),
        headers={"content-type": content_type}
    )

    # Save the file
    await temp_file_service.save_upload(file, job_id)

    # Verify directory exists
    job_dir = temp_file_service.base_upload_dir / job_id
    assert job_dir.exists()

    # Cleanup
    result = temp_file_service.cleanup_job(job_id)
    assert result is True
    assert not job_dir.exists()


@pytest.mark.anyio
async def test_cleanup_job_nonexistent(temp_file_service):
    """Test cleanup of non-existent job"""
    result = temp_file_service.cleanup_job("nonexistent-job-id")
    assert result is False


@pytest.mark.anyio
async def test_get_job_directory(temp_file_service):
    """Test job directory creation"""
    job_id = temp_file_service.generate_job_id()
    job_dir = temp_file_service.get_job_directory(job_id)

    assert job_dir.exists()
    assert job_dir.is_dir()
    assert job_dir.name == job_id


@pytest.mark.anyio
async def test_get_file_path(temp_file_service):
    """Test getting file path"""
    job_id = "test-job-123"
    file_path = temp_file_service.get_file_path(job_id, "test.mp4")

    assert file_path.parent.name == job_id
    assert file_path.name == "test.mp4"
