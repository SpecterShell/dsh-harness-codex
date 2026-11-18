"""Size-based log rotation used by the collector."""
import os
from pathlib import Path


def should_rotate(path, limit_bytes):
    try:
        return Path(path).stat().st_size >= limit_bytes
    except FileNotFoundError:
        return False


def rotated_name(path, index):
    base = Path(path)
    return base.with_name(f"{base.name}.{index}")


def plan_rotation(path, limit_bytes, keep=5):
    """Return the list of renames needed, oldest last."""
    if not should_rotate(path, limit_bytes):
        return []
    renames = []
    for index in range(keep - 1, 0, -1):
        source = rotated_name(path, index)
        target = rotated_name(path, index + 1)
        if source.exists():
            renames.append((source, target))
    renames.append((Path(path), rotated_name(path, 1)))
    return renames


def rotate(path, limit_bytes, keep=5):
    for source, target in plan_rotation(path, limit_bytes, keep):
        os.replace(source, target)
    return Path(path)
