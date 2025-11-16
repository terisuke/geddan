"""
File validation utilities for FastAPI dependencies
"""

from fastapi import UploadFile, HTTPException, status
import logging
import magic
from typing import List

logger = logging.getLogger(__name__)

# Configuration constants
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB in bytes
ALLOWED_CONTENT_TYPES = ["video/mp4", "image/gif"]
ALLOWED_EXTENSIONS = [".mp4", ".gif"]
MAGIC_BUFFER_SIZE = 2048  # Bytes to read for magic number detection
STREAM_CHUNK_SIZE = 8192  # 8KB chunks for streaming validation


async def validate_video_upload(file: UploadFile) -> UploadFile:
    """
    FastAPI dependency for validating video file uploads

    Validates:
    - Content type (MIME)
    - File size
    - File extension

    Args:
        file: Uploaded file from request

    Returns:
        The same file if validation passes

    Raises:
        HTTPException: If validation fails
    """
    # Validate file presence
    if not file:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No file provided",
        )

    # Validate content type (header check first)
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        logger.warning(
            f"Invalid content type header: {file.content_type} for file {file.filename}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only MP4 and GIF files are allowed. Received: {file.content_type}",
        )

    # Validate file extension (additional check)
    if file.filename:
        file_ext = file.filename.lower().split(".")[-1] if "." in file.filename else ""
        if f".{file_ext}" not in ALLOWED_EXTENSIONS:
            logger.warning(f"Invalid extension: .{file_ext} for file {file.filename}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File must have .mp4 or .gif extension. Received: .{file_ext}",
            )

    # Read first chunk for magic number detection
    first_chunk = await file.read(MAGIC_BUFFER_SIZE)

    if len(first_chunk) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="File is empty"
        )

    # Validate actual file type using magic number (byte-level inspection)
    try:
        detected_mime = magic.from_buffer(first_chunk, mime=True)
        if detected_mime not in ALLOWED_CONTENT_TYPES:
            logger.warning(
                f"Magic number detection mismatch: header={file.content_type}, "
                f"detected={detected_mime} for file {file.filename}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File content does not match declared type. "
                f"Expected MP4 or GIF, detected: {detected_mime}",
            )
    except Exception as e:
        logger.error(f"Failed to detect file type for {file.filename}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to validate file type",
        )

    # Validate file size with streaming (memory-efficient)
    file_size = len(first_chunk)

    # Continue reading in chunks until we hit size limit or EOF
    while True:
        chunk = await file.read(STREAM_CHUNK_SIZE)
        if not chunk:
            break

        file_size += len(chunk)

        # Immediately abort if size exceeds limit (early termination saves memory)
        if file_size > MAX_FILE_SIZE:
            logger.warning(
                f"File size exceeds limit during streaming for {file.filename}"
            )
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds maximum allowed size (100MB)",
            )

    # Reset file pointer to beginning for subsequent reads
    await file.seek(0)

    logger.info(
        f"Validated file: {file.filename} ({file_size} bytes, {file.content_type})"
    )

    return file


def get_validation_rules() -> dict:
    """
    Get validation rules for documentation/client-side validation

    Returns:
        Dictionary with validation constraints
    """
    return {
        "max_file_size_mb": MAX_FILE_SIZE / 1024 / 1024,
        "allowed_types": ALLOWED_CONTENT_TYPES,
        "allowed_extensions": ALLOWED_EXTENSIONS,
    }
