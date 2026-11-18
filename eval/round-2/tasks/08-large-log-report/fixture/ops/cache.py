"""Tiny file cache for repeated on-call lookups."""
from pathlib import Path


class FileCache:
    def __init__(self, root):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def key_path(self, key):
        safe = "".join(char if char.isalnum() or char in "-_." else "_" for char in key)
        return self.root / f"{safe}.json"

    def get(self, key, loader):
        path = self.key_path(key)
        if path.is_file():
            return path.read_text(encoding="utf-8")
        value = loader()
        path.write_text(value, encoding="utf-8")
        return value

    def clear(self):
        for path in self.root.glob("*.json"):
            path.unlink()
