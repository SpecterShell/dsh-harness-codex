"""Small config loader for the cron environment."""
import json
import os
from dataclasses import dataclass
from pathlib import Path

DEFAULTS = {
    "log_path": "logs/service.log",
    "out_dir": "out",
    "p95_threshold_ms": 2500,
    "retention_days": 14,
}


@dataclass(frozen=True)
class Config:
    log_path: str
    out_dir: str
    p95_threshold_ms: int
    retention_days: int


def from_mapping(mapping):
    values = {**DEFAULTS, **mapping}
    return Config(
        log_path=str(values["log_path"]),
        out_dir=str(values["out_dir"]),
        p95_threshold_ms=int(values["p95_threshold_ms"]),
        retention_days=int(values["retention_days"]),
    )


def load(path=None):
    if path is None:
        path = os.environ.get("OPS_CONFIG")
    if not path:
        return from_mapping({})
    return from_mapping(json.loads(Path(path).read_text(encoding="utf-8")))
