import unittest
import imagehash
from pathlib import Path
from unittest.mock import MagicMock, patch
from app.services.hash_analyzer import HashAnalyzer

class TestHashAnalyzer(unittest.TestCase):
    def setUp(self):
        # Initialize analyzer with specific threshold for testing
        self.analyzer = HashAnalyzer(hamming_threshold=5)

    def test_cluster_frames_exact_duplicates(self):
        """Test clustering of identical frames"""
        # Create dummy hashes
        # Frame 0 and Frame 1 have identical hash
        hash1 = imagehash.hex_to_hash('0000000000000000')
        hash2 = imagehash.hex_to_hash('0000000000000000')
        hash3 = imagehash.hex_to_hash('ffffffffffffffff')

        frame_hashes = {
            Path("frame_0000.png"): hash1,
            Path("frame_0001.png"): hash2,
            Path("frame_0002.png"): hash3
        }

        clusters, mapping = self.analyzer.cluster_frames(frame_hashes)

        # Expect 2 clusters
        self.assertEqual(len(clusters), 2)
        
        # Frame 0 and 1 should be in same cluster (Cluster 0)
        self.assertEqual(mapping[0], 0)
        self.assertEqual(mapping[1], 0)
        
        # Frame 2 should be in new cluster (Cluster 1)
        self.assertEqual(mapping[2], 1)

    def test_cluster_frames_similarity(self):
        """Test clustering based on hamming distance"""
        # Hash 1: Base
        hash1 = imagehash.hex_to_hash('0000000000000000')
        
        # Hash 2: Differs by 1 bit (distance 1) -> Should cluster with Hash 1
        hash2 = imagehash.hex_to_hash('0000000000000001')
        
        # Hash 3: Differs by 10 bits (distance 10) -> Should be new cluster
        hash3 = imagehash.hex_to_hash('000000000000ffff') # 16 bits different (0000...0000 vs ...1111) approx?
        # Let's use simple bit diff
        # 'f' is 1111. '0' is 0000.
        # last char '1' (0001) vs '0' (0000) is 1 bit diff.
        
        # frame 3: very different
        
        frame_hashes = {
            Path("frame_0000.png"): hash1,
            Path("frame_0001.png"): hash2,
            Path("frame_0002.png"): hash3
        }
        
        # Mock hamming distance if needed? 
        # imagehash subtraction operator returns distance.
        # hex_to_hash works correctly.

        clusters, mapping = self.analyzer.cluster_frames(frame_hashes)
        
        # Check logic
        # 0 and 1 are close (dist <= 5)
        # 2 is far
        
        self.assertEqual(mapping[0], 0)
        self.assertEqual(mapping[1], 0)
        self.assertNotEqual(mapping[2], 0)

    def test_mapping_indices(self):
        """Ensure mapping indices correspond to sorted filenames"""
        hashes = {
            Path("frame_0010.png"): imagehash.hex_to_hash('0000'),
            Path("frame_0001.png"): imagehash.hex_to_hash('ffff'),
            Path("frame_0005.png"): imagehash.hex_to_hash('0000') # Same as 0010
        }
        
        # Sorted order should be: frame_0001, frame_0005, frame_0010
        # Indices: 0, 1, 2
        
        # frame_0001 (0) -> Cluster A
        # frame_0005 (1) -> Cluster B (different from A)
        # frame_0010 (2) -> Cluster B (same as 1)
        
        clusters, mapping = self.analyzer.cluster_frames(hashes)
        
        # 0001 is 'ffff', others '0000'. distance is high.
        
        # Mapping[0] (frame_0001) should be Cluster 0
        # Mapping[1] (frame_0005) should be Cluster 1
        # Mapping[2] (frame_0010) should be Cluster 1
        
        self.assertEqual(mapping[0], 0)
        self.assertEqual(mapping[1], 1)
        self.assertEqual(mapping[2], 1)


if __name__ == '__main__':
    unittest.main()
