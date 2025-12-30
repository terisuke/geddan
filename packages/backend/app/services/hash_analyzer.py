"""
Perceptual hash (pHash) analyzer for frame clustering.

Uses imagehash library to compute perceptual hashes and cluster similar frames.
This helps identify unique poses/keyframes in animation loops.

Performance optimizations:
- Batch processing with configurable chunk size
- Memory-efficient image handling (explicit cleanup)
- Parallel hash computation using ThreadPoolExecutor
- Generator-based processing for large frame sets
"""

import imagehash
from PIL import Image
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Iterator, Generator
import logging
from collections import defaultdict
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
import gc

logger = logging.getLogger(__name__)

# Performance configuration
DEFAULT_CHUNK_SIZE = 100  # Process frames in batches
HASH_PARALLEL_WORKERS = int(os.getenv("HASH_PARALLEL_WORKERS", str(os.cpu_count() or 4)))
ENABLE_PARALLEL_HASHING = os.getenv("HASH_ENABLE_PARALLEL", "true").lower() == "true"


def _compute_single_hash(
    frame_path: Path, hash_size: int
) -> Tuple[Path, Optional[imagehash.ImageHash]]:
    """
    Compute perceptual hash for a single frame (worker function).

    Args:
        frame_path: Path to frame image.
        hash_size: Hash size parameter.

    Returns:
        Tuple of (frame_path, hash) or (frame_path, None) on error.
    """
    try:
        with Image.open(frame_path) as img:
            phash = imagehash.phash(img, hash_size=hash_size)
            return (frame_path, phash)
    except Exception as e:
        logger.error(f"Failed to compute hash for {frame_path}: {e}")
        return (frame_path, None)


class HashAnalyzer:
    """
    Analyze frames using perceptual hashing and clustering.

    Uses imagehash.phash to compute perceptual hashes, then clusters
    frames based on Hamming distance between hashes.

    Performance features:
    - Optional parallel hash computation
    - Chunked processing for memory efficiency
    - Explicit garbage collection after large batches
    """

    def __init__(
        self,
        hash_size: int = 8,
        hamming_threshold: Optional[int] = None,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        parallel_workers: int = HASH_PARALLEL_WORKERS,
        enable_parallel: bool = ENABLE_PARALLEL_HASHING,
    ):
        """
        Initialize HashAnalyzer.

        Args:
            hash_size: Size of the hash (8 = 64-bit hash, 16 = 256-bit hash).
                       Smaller = faster, less precise.
                       Larger = slower, more precise.
            hamming_threshold: Maximum Hamming distance to consider frames as similar.
                              If None, reads from HASH_HAMMING_THRESHOLD env var (default: 6).
                              Lower = stricter clustering (more clusters).
                              Higher = looser clustering (fewer clusters).
                              Recommended: 5-7 (higher for high FPS videos).
            chunk_size: Number of frames to process before garbage collection.
            parallel_workers: Number of parallel workers for hash computation.
            enable_parallel: Whether to use parallel processing.
        """
        self.hash_size = hash_size
        self.chunk_size = chunk_size
        self.parallel_workers = parallel_workers
        self.enable_parallel = enable_parallel

        # Read hamming threshold from environment variable if not provided
        if hamming_threshold is None:
            hamming_threshold = int(os.getenv("HASH_HAMMING_THRESHOLD", "6"))
            logger.debug(f"Using hamming_threshold from environment: {hamming_threshold}")

        self.hamming_threshold = hamming_threshold

        logger.info(
            f"HashAnalyzer initialized: hash_size={hash_size}, threshold={hamming_threshold}, "
            f"chunk_size={chunk_size}, parallel={enable_parallel}, workers={parallel_workers}"
        )

    def compute_hashes(self, frame_paths: List[Path]) -> Dict[Path, imagehash.ImageHash]:
        """
        Compute perceptual hashes for all frames.

        Uses parallel processing when enabled for better performance.
        Processes frames in chunks to manage memory usage.

        Args:
            frame_paths: List of paths to frame image files.

        Returns:
            Dictionary mapping frame paths to their perceptual hashes.

        Raises:
            RuntimeError: If hash computation fails.
        """
        total_frames = len(frame_paths)
        logger.info(
            f"Computing pHash for {total_frames} frames "
            f"(hash_size={self.hash_size}, parallel={self.enable_parallel})"
        )

        if self.enable_parallel and total_frames > 10:
            # Use parallel processing for larger frame sets
            hashes = self._compute_hashes_parallel(frame_paths)
        else:
            # Use sequential processing for small sets or when disabled
            hashes = self._compute_hashes_sequential(frame_paths)

        logger.info(f"Computed {len(hashes)} perceptual hashes")
        return hashes

    def _compute_hashes_sequential(
        self, frame_paths: List[Path]
    ) -> Dict[Path, imagehash.ImageHash]:
        """
        Compute hashes sequentially with memory management.

        Args:
            frame_paths: List of frame paths.

        Returns:
            Dictionary of frame paths to hashes.
        """
        hashes = {}
        processed = 0

        for frame_path in frame_paths:
            try:
                with Image.open(frame_path) as img:
                    phash = imagehash.phash(img, hash_size=self.hash_size)
                    hashes[frame_path] = phash

                processed += 1

                # Garbage collect after each chunk to manage memory
                if processed % self.chunk_size == 0:
                    gc.collect()
                    logger.debug(f"Processed {processed}/{len(frame_paths)} frames")

            except Exception as e:
                logger.error(f"Failed to compute hash for {frame_path}: {e}")
                raise RuntimeError(f"Hash computation failed for {frame_path.name}: {e}")

        return hashes

    def _compute_hashes_parallel(
        self, frame_paths: List[Path]
    ) -> Dict[Path, imagehash.ImageHash]:
        """
        Compute hashes in parallel using ThreadPoolExecutor.

        Args:
            frame_paths: List of frame paths.

        Returns:
            Dictionary of frame paths to hashes.
        """
        hashes = {}
        failed_frames = []

        with ThreadPoolExecutor(max_workers=self.parallel_workers) as executor:
            # Submit all tasks
            futures = {
                executor.submit(_compute_single_hash, path, self.hash_size): path
                for path in frame_paths
            }

            # Collect results as they complete
            for i, future in enumerate(as_completed(futures)):
                frame_path, phash = future.result()

                if phash is not None:
                    hashes[frame_path] = phash
                else:
                    failed_frames.append(frame_path)

                # Log progress periodically
                if (i + 1) % self.chunk_size == 0:
                    logger.debug(f"Processed {i + 1}/{len(frame_paths)} frames")

        # Cleanup
        gc.collect()

        if failed_frames:
            raise RuntimeError(
                f"Hash computation failed for {len(failed_frames)} frames: "
                f"{failed_frames[0].name}"
            )

        return hashes

    def cluster_frames(
        self,
        frame_hashes: Dict[Path, imagehash.ImageHash]
    ) -> Tuple[List[List[Path]], Dict[int, int]]:
        """
        Cluster frames based on perceptual hash similarity

        Uses Hamming distance between hashes to group similar frames.
        Frames with Hamming distance <= threshold are grouped together.

        Args:
            frame_hashes: Dictionary mapping frame paths to their hashes

        Returns:
            Tuple containing:
            - List of clusters, where each cluster is a list of frame paths
            - Dictionary mapping frame index (0-based, sorted by filename) to cluster ID
        """
        if not frame_hashes:
            return [], {}

        # Sort frames by name for consistent ordering (assumes frame_XXXX.png format)
        sorted_frames = sorted(frame_hashes.items(), key=lambda x: x[0].name)

        clusters: List[List[Path]] = []
        cluster_representatives: List[imagehash.ImageHash] = []
        frame_mapping: Dict[int, int] = {}

        logger.info(f"Clustering {len(sorted_frames)} frames (threshold={self.hamming_threshold})")

        for frame_idx, (frame_path, frame_hash) in enumerate(sorted_frames):
            # Find closest cluster
            min_distance = float('inf')
            closest_cluster_idx = -1

            for idx, rep_hash in enumerate(cluster_representatives):
                distance = frame_hash - rep_hash  # Hamming distance
                if distance < min_distance:
                    min_distance = distance
                    closest_cluster_idx = idx

            # Add to existing cluster or create new one
            if min_distance <= self.hamming_threshold:
                clusters[closest_cluster_idx].append(frame_path)
                frame_mapping[frame_idx] = closest_cluster_idx
            else:
                # Create new cluster
                new_cluster_idx = len(clusters)
                clusters.append([frame_path])
                cluster_representatives.append(frame_hash)
                frame_mapping[frame_idx] = new_cluster_idx

        logger.info(
            f"Created {len(clusters)} clusters from {len(sorted_frames)} frames "
            f"(avg {len(sorted_frames) / len(clusters):.1f} frames/cluster)"
        )

        return clusters, frame_mapping

    def select_representatives(
        self,
        clusters: List[List[Path]]
    ) -> List[Tuple[int, Path, int]]:
        """
        Select representative frame from each cluster

        Args:
            clusters: List of frame clusters

        Returns:
            List of (cluster_id, representative_path, cluster_size) tuples
        """
        representatives = []

        for cluster_id, cluster_frames in enumerate(clusters):
            if not cluster_frames:
                continue

            # Use first frame as representative (earliest in sequence)
            representative = cluster_frames[0]
            cluster_size = len(cluster_frames)

            representatives.append((cluster_id, representative, cluster_size))

            logger.debug(
                f"Cluster {cluster_id}: {cluster_size} frames, "
                f"representative: {representative.name}"
            )

        logger.info(f"Selected {len(representatives)} cluster representatives")
        return representatives

    def analyze(self, frame_paths: List[Path]) -> Tuple[List[Tuple[int, Path, int]], Dict[int, int]]:
        """
        Full analysis pipeline: compute hashes, cluster, select representatives

        Args:
            frame_paths: List of paths to frame image files

        Returns:
            Tuple containing:
            - List of (cluster_id, representative_path, cluster_size) tuples
            - Dictionary mapping frame index to cluster ID

        Raises:
            RuntimeError: If analysis fails
        """
        if not frame_paths:
            raise RuntimeError("No frames provided for analysis")

        # Step 1: Compute perceptual hashes
        frame_hashes = self.compute_hashes(frame_paths)

        # Step 2: Cluster frames by hash similarity
        clusters, frame_mapping = self.cluster_frames(frame_hashes)

        # Step 3: Select representative from each cluster
        representatives = self.select_representatives(clusters)

        return representatives, frame_mapping


# Create singleton instance with environment-configured hamming threshold
# Default: hamming_threshold=6 (configurable via HASH_HAMMING_THRESHOLD environment variable)
# Higher threshold = looser clustering = fewer clusters, merges similar poses
# Recommended for 60fps videos to merge duplicate frames into same cluster
hash_analyzer = HashAnalyzer(hash_size=8)  # Will read hamming_threshold from env
