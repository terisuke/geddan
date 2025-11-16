"""
File service for handling video uploads and storage
"""

from fastapi import UploadFile
from pathlib import Path
import uuid
import logging
from typing import Tuple
import shutil

logger = logging.getLogger(__name__)


class FileService:
    """Service for file storage operations"""

    def __init__(self, base_upload_dir: str = "uploads"):
        self.base_upload_dir = Path(base_upload_dir)
        self.base_upload_dir.mkdir(parents=True, exist_ok=True)

    def generate_job_id(self) -> str:
        """Generate a unique job ID"""
        return str(uuid.uuid4())

    def get_job_directory(self, job_id: str) -> Path:
        """Get the directory path for a job"""
        job_dir = self.base_upload_dir / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        return job_dir

    async def save_upload(
        self, file: UploadFile, job_id: str
    ) -> Tuple[Path, int]:
        """
        Save uploaded file to disk

        Args:
            file: UploadFile instance
            job_id: Unique job identifier

        Returns:
            Tuple of (file_path, file_size)
        """
        try:
            # Get job directory
            job_dir = self.get_job_directory(job_id)

            # Preserve original filename with extension
            original_filename = file.filename or "upload"
            file_extension = Path(original_filename).suffix or ".mp4"
            safe_filename = f"original{file_extension}"

            file_path = job_dir / safe_filename

            # Save file with streaming to handle large files
            file_size = 0
            with open(file_path, "wb") as buffer:
                # Read and write in chunks for memory efficiency
                while chunk := await file.read(8192):  # 8KB chunks
                    buffer.write(chunk)
                    file_size += len(chunk)

            logger.info(
                f"Saved file {safe_filename} ({file_size} bytes) to {job_dir}"
            )

            return file_path, file_size

        except Exception as e:
            logger.error(f"Failed to save file for job {job_id}: {e}")
            raise

    def cleanup_job(self, job_id: str) -> bool:
        """
        Delete all files for a job

        Args:
            job_id: Job identifier to cleanup

        Returns:
            True if successful, False otherwise
        """
        try:
            job_dir = self.base_upload_dir / job_id
            if job_dir.exists():
                shutil.rmtree(job_dir)
                logger.info(f"Cleaned up job directory: {job_dir}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to cleanup job {job_id}: {e}")
            return False

    def get_file_path(self, job_id: str, filename: str = "original.mp4") -> Path:
        """Get path to a specific file in a job directory"""
        return self.base_upload_dir / job_id / filename


# Singleton instance
file_service = FileService()
