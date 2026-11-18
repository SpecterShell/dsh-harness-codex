#!/usr/bin/env python3
"""Snapshot the item data into a small state file."""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "items.json"
DEFAULT_STATE = Path("/tmp/r2-ws-sentinel-06/state.json")


def build_state(items):
    return {
        "version": 1,
        "item_count": len(items),
        "ids": [item["id"] for item in items],
    }


def sync(items_path, state_path):
    items = json.loads(Path(items_path).read_text(encoding="utf-8"))
    state = build_state(items)
    state_path = Path(state_path)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    return state_path


def read_state(state_path):
    return json.loads(Path(state_path).read_text(encoding="utf-8"))


def main(argv=None):
    parser = argparse.ArgumentParser(prog="syncctl")
    sub = parser.add_subparsers(dest="command", required=True)
    sync_cmd = sub.add_parser("sync")
    sync_cmd.add_argument("--state")
    show_cmd = sub.add_parser("show")
    show_cmd.add_argument("--state")
    args = parser.parse_args(argv)

    state = Path(args.state) if args.state else DEFAULT_STATE
    if args.command == "sync":
        path = sync(DATA, state)
        print(f"wrote {path}")
    else:
        print(json.dumps(read_state(state), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
