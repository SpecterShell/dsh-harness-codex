#!/usr/bin/env python3
"""Print service status from a JSON config."""

import argparse
import json
from pathlib import Path

DEFAULT_CONFIG = Path(__file__).resolve().parent / "config" / "service.json"


def main(argv=None):
    parser = argparse.ArgumentParser(prog="status")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    text = Path(args.config).read_text(encoding="utf-8")
    config = json.loads(text)

    name = config.get("name", "unknown")
    port = config.get("port", 8080)
    if args.json:
        print(json.dumps({"name": name, "port": port, "healthy": True}, sort_keys=True))
    else:
        print(f"{name} is up on port {port}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
