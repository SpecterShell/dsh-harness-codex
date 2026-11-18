"""Read and write the stock JSON file."""

import json
from pathlib import Path

from .errors import StorageError, ValidationError
from .models import Item


class JsonStore:
    """A small JSON-backed item store."""

    def __init__(self, path):
        self.path = Path(path)

    def load(self):
        """Return every item in the file."""
        try:
            raw = self.path.read_text(encoding="utf-8")
        except FileNotFoundError as error:
            raise StorageError(f"data file not found: {self.path}") from error
        except OSError as error:
            raise StorageError(f"cannot read {self.path}: {error}") from error

        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as error:
            raise StorageError(f"invalid JSON in {self.path}: {error}") from error

        if not isinstance(payload, dict) or not isinstance(payload.get("items"), list):
            raise StorageError(f"{self.path} must contain an items array")

        items = []
        for entry in payload["items"]:
            try:
                items.append(Item.from_dict(entry))
            except ValidationError as error:
                raise StorageError(f"invalid item in {self.path}: {error}") from error
            except KeyError as error:
                raise StorageError(f"item in {self.path} is missing {error}") from error
            except TypeError as error:
                raise StorageError(f"invalid item shape in {self.path}: {error}") from error
        return items

    def save(self, items):
        """Replace the file contents with these items."""
        payload = {"items": [item.to_dict() for item in items]}
        text = json.dumps(payload, indent=2, sort_keys=True) + "\n"
        temporary = self.path.with_name(self.path.name + ".tmp")
        try:
            temporary.write_text(text, encoding="utf-8")
            temporary.replace(self.path)
        except OSError as error:
            raise StorageError(f"cannot write {self.path}: {error}") from error
