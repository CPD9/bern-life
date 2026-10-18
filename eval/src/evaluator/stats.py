"""Intervals for the evaluation report, with the draws and seed the pre-registration fixes.

Adapted from CPD9/apertus-redteam-graph, track_1a/src/redteam/stats.py (Apache-2.0). Its bootstrap
resampled a two-way grid (speakers by sentences); here the clusters are one-way: a base need and
its variants are drawn together, because one need's rewordings are not independent queries.
"""

import random
from collections.abc import Mapping, Sequence
from math import sqrt

DRAWS, SEED = 2000, 1


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """95% Wilson interval for k successes in n trials. Behaves well at small n and k=0/n."""
    if n == 0:
        return 0.0, 1.0
    p = k / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return max(0.0, centre - half), min(1.0, centre + half)


def cluster_bootstrap(
    clusters: Mapping[str, Sequence[float]], draws: int = DRAWS, seed: int = SEED
) -> tuple[float, float] | None:
    """95% interval for the mean over every value, resampling whole clusters with replacement.
    None when there is nothing to resample."""
    names = sorted(name for name, values in clusters.items() if values)
    if not names:
        return None
    rng = random.Random(seed)
    means = []
    for _ in range(draws):
        drawn = rng.choices(names, k=len(names))
        total = sum(sum(clusters[name]) for name in drawn)
        count = sum(len(clusters[name]) for name in drawn)
        means.append(total / count)
    means.sort()
    return means[round(0.025 * (len(means) - 1))], means[round(0.975 * (len(means) - 1))]
