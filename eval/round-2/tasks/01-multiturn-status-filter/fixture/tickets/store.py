import json
from pathlib import Path

from .model import from_dict


def load_tickets(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return [from_dict(row) for row in data["tickets"]]
