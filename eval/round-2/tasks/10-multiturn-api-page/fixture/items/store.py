import json
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "items.json"


def load_items(path=DATA):
    return json.loads(Path(path).read_text(encoding="utf-8"))["items"]
