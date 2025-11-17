"""
Perceptual hash (pHash) analyzer for frame clustering

Uses imagehash library to compute perceptual hashes and cluster similar frames.
This helps identify unique poses/keyframes in animation loops.
"""

import imagehash
from PIL import Image
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import logging
from collections import defaultdict
import os

logger = logging.getLogger(__name__)


class HashAnalyzer:
    """
    Analyze frames using perceptual hashing and clustering

    Uses imagehash.phash to compute perceptual hashes, then clusters
    frames based on Hamming distance between hashes.
    """

    def __init__(self, hash_size: int = 8, hamming_threshold: Optional[int] = None):
        """
        Initialize HashAnalyzer

        Args:
            hash_size: Size of the hash (8 = 64-bit hash, 16 = 256-bit hash)
                       Smaller = faster, less precise
                       Larger = slower, more precise
            hamming_threshold: Maximum Hamming distance to consider frames as similar
                              If None, reads from HASH_HAMMING_THRESHOLD env var (default: 6)
                              Lower = stricter clustering (more clusters, separates similar poses)
                              Higher = looser clustering (fewer clusters, merges similar poses)
                              Recommended: 5-7 (higher for high FPS videos to merge duplicates)
        """
        self.hash_size = hash_size

        # Read hamming threshold from environment variable if not provided
        if hamming_threshold is None:
            hamming_threshold = int(os.getenv("HASH_HAMMING_THRESHOLD", "6"))
            logger.debug(f"Using hamming_threshold from environment: {hamming_threshold}")

        self.hamming_threshold = hamming_threshold

    def compute_hashes(self, frame_paths: List[Path]) -> Dict[Path, imagehash.ImageHash]:
        """
        Compute perceptual hashes for all frames

        Args:
            frame_paths: List of paths to frame image files

        Returns:
            Dictionary mapping frame paths to their perceptual hashes

        Raises:
            RuntimeError: If hash computation fails
        """
        hashes = {}

        logger.info(f"Computing pHash for {len(frame_paths)} frames (hash_size={self.hash_size})")

        for frame_path in frame_paths:
            try:
                with Image.open(frame_path) as img:
                    # Compute perceptual hash
                    phash = imagehash.phash(img, hash_size=self.hash_size)
                    hashes[frame_path] = phash

            except Exception as e:
                logger.error(f"Failed to compute hash for {frame_path}: {e}")
                raise RuntimeError(f"Hash computation failed for {frame_path.name}: {e}")

        logger.info(f"Computed {len(hashes)} perceptual hashes")
        return hashes

    def cluster_frames(
        self,
        frame_hashes: Dict[Path, imagehash.ImageHash]
    ) -> List[List[Path]]:
        """
        Cluster frames based on perceptual hash similarity

        Uses Hamming distance between hashes to group similar frames.
        Frames with Hamming distance <= threshold are grouped together.

        Args:
            frame_hashes: Dictionary mapping frame paths to their hashes

        Returns:
            List of clusters, where each cluster is a list of frame paths

        Algorithm:
            1. Sort frames by hash value for consistency
            2. For each frame, check if it's similar to any existing cluster representative
            3. If similar, add to that cluster; otherwise, create new cluster
        """
        if not frame_hashes:
            return []

        # Sort frames by name for consistent ordering
        sorted_frames = sorted(frame_hashes.items(), key=lambda x: x[0].name)

        clusters: List[List[Path]] = []
        cluster_representatives: List[imagehash.ImageHash] = []

        logger.info(f"Clustering {len(sorted_frames)} frames (threshold={self.hamming_threshold})")

        for frame_path, frame_hash in sorted_frames:
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
            else:
                # Create new cluster
                clusters.append([frame_path])
                cluster_representatives.append(frame_hash)

        logger.info(
            f"Created {len(clusters)} clusters from {len(sorted_frames)} frames "
            f"(avg {len(sorted_frames) / len(clusters):.1f} frames/cluster)"
        )

        return clusters

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

    def analyze(self, frame_paths: List[Path]) -> List[Tuple[int, Path, int]]:
        """
        Full analysis pipeline: compute hashes, cluster, select representatives

        Args:
            frame_paths: List of paths to frame image files

        Returns:
            List of (cluster_id, representative_path, cluster_size) tuples

        Raises:
            RuntimeError: If analysis fails
        """
        if not frame_paths:
            raise RuntimeError("No frames provided for analysis")

        # Step 1: Compute perceptual hashes
        frame_hashes = self.compute_hashes(frame_paths)

        # Step 2: Cluster frames by hash similarity
        clusters = self.cluster_frames(frame_hashes)

        # Step 3: Select representative from each cluster
        representatives = self.select_representatives(clusters)

        return representatives


# Create singleton instance with environment-configured hamming threshold
# Default: hamming_threshold=6 (configurable via HASH_HAMMING_THRESHOLD environment variable)
# Higher threshold = looser clustering = fewer clusters, merges similar poses
# Recommended for 60fps videos to merge duplicate frames into same cluster
hash_analyzer = HashAnalyzer(hash_size=8)  # Will read hamming_threshold from env
