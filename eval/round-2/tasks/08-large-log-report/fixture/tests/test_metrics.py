import unittest

from ops.metrics import nearest_rank


class NearestRankTest(unittest.TestCase):
    def test_rank_one_is_smallest(self):
        self.assertEqual(nearest_rank([5, 1, 3], 50), 3)

    def test_p95_of_twenty(self):
        self.assertEqual(nearest_rank(list(range(1, 21)), 95), 19)


if __name__ == "__main__":
    unittest.main()
