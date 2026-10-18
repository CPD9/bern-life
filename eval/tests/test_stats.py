import unittest

from evaluator.stats import cluster_bootstrap, wilson


class StatsTest(unittest.TestCase):
    def test_wilson_nine_of_ten(self) -> None:
        low, high = wilson(9, 10)
        self.assertEqual((round(low, 4), round(high, 4)), (0.5958, 0.9821))

    def test_bootstrap_with_seed_one_repeats_exactly(self) -> None:
        clusters = {"q001": [1.0, 0.5, 1.0], "q002": [0.0, 0.0], "q003": [1.0], "q004": [0.5, 0.0]}
        first = cluster_bootstrap(clusters)
        self.assertEqual(first, cluster_bootstrap(clusters))
        self.assertEqual(first, (0.125, 0.875))

    def test_bootstrap_of_one_constant_cluster_and_of_nothing(self) -> None:
        self.assertEqual(cluster_bootstrap({"q001": [0.5, 0.5]}), (0.5, 0.5))
        self.assertIsNone(cluster_bootstrap({"q001": []}))


if __name__ == "__main__":
    unittest.main()
