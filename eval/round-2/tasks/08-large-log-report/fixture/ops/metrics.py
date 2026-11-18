def nearest_rank(values, percentile):
    """Return the nearest-rank percentile of a non-empty sequence."""
    ordered = sorted(values)
    rank = -(-len(ordered) * percentile // 100)
    return ordered[rank - 1]
