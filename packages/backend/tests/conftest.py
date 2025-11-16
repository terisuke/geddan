"""
Pytest configuration and fixtures
"""

import pytest
import tempfile
import shutil
from pathlib import Path
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.services import file_service


@pytest.fixture(scope="session", autouse=True)
def setup_test_upload_dir():
    """
    Setup temporary upload directory for tests

    This fixture runs once per test session and automatically
    redirects all file uploads to a temporary directory,
    preventing test pollution of the production uploads/ folder.
    """
    # Create temporary directory
    temp_dir = tempfile.mkdtemp(prefix="test_uploads_")
    original_dir = file_service.file_service.base_upload_dir

    # Redirect FileService to use temp directory
    file_service.file_service.base_upload_dir = Path(temp_dir)

    yield temp_dir

    # Cleanup: restore original directory and remove temp files
    file_service.file_service.base_upload_dir = original_dir
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
async def client():
    """
    Async test client for FastAPI app

    Usage:
        async def test_something(client):
            response = await client.get("/")
            assert response.status_code == 200
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
def sample_mp4_file():
    """
    Sample MP4 file data for testing

    Returns:
        Tuple of (filename, content, content_type)
    """
    # Minimal valid MP4 header
    content = b"\x00\x00\x00\x1c\x66\x74\x79\x70\x69\x73\x6f\x6d" + b"x" * 1000
    return ("test_video.mp4", content, "video/mp4")


@pytest.fixture
def sample_gif_file():
    """Sample GIF file data for testing"""
    # GIF89a header
    content = b"GIF89a" + b"x" * 1000
    return ("test_animation.gif", content, "image/gif")


@pytest.fixture
def large_file():
    """File exceeding size limit (>100MB)"""
    # Valid MP4 header + padding to exceed 100MB
    mp4_header = b"\x00\x00\x00\x1c\x66\x74\x79\x70\x69\x73\x6f\x6d"
    padding = b"x" * (101 * 1024 * 1024 - len(mp4_header))  # 101MB total
    content = mp4_header + padding
    return ("large_video.mp4", content, "video/mp4")


@pytest.fixture
def invalid_file():
    """File with invalid content type"""
    content = b"not a valid video"
    return ("document.pdf", content, "application/pdf")
