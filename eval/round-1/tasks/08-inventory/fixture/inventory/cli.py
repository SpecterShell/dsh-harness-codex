"""Command line entry point."""

import argparse
import json
import os
import sys

from .errors import InventoryError, NotFoundError
from .reports import format_cents, render_items, render_low_stock
from .service import InventoryService
from .storage import JsonStore

DEFAULT_DATA = "data/stock.json"


def build_parser():
    """Build the argument parser."""
    parser = argparse.ArgumentParser(
        prog="inventory",
        description="Inspect and adjust warehouse stock.",
    )
    parser.add_argument(
        "--data",
        default=os.environ.get("INVENTORY_DATA", DEFAULT_DATA),
        help=f"stock JSON file (default: {DEFAULT_DATA})",
    )
    subcommands = parser.add_subparsers(dest="command", required=True)

    list_parser = subcommands.add_parser("list", help="list every item")
    list_parser.add_argument("--json", action="store_true", help="print JSON")

    low_parser = subcommands.add_parser(
        "low-stock", help="list items at or below their reorder point"
    )
    low_parser.add_argument("--json", action="store_true", help="print JSON")

    value_parser = subcommands.add_parser("value", help="print the total stock value")
    value_parser.add_argument("--json", action="store_true", help="print JSON")

    show_parser = subcommands.add_parser("show", help="show one item")
    show_parser.add_argument("sku")
    show_parser.add_argument("--json", action="store_true", help="print JSON")

    adjust_parser = subcommands.add_parser("adjust", help="change one item's quantity")
    adjust_parser.add_argument("sku")
    adjust_parser.add_argument("delta", type=int)
    adjust_parser.add_argument("--json", action="store_true", help="print JSON")

    return parser


def _print_items(items, as_json, renderer, empty_message):
    if as_json:
        payload = {"count": len(items), "items": [item.to_dict() for item in items]}
        print(json.dumps(payload, sort_keys=True))
    elif items:
        print(renderer(items))
    else:
        print(empty_message)
    return 0


def main(argv=None):
    """Run one CLI command and return its exit code."""
    args = build_parser().parse_args(argv)
    service = InventoryService(JsonStore(args.data))

    try:
        if args.command == "list":
            return _print_items(service.list_items(), args.json, render_items, "no items")
        if args.command == "low-stock":
            return _print_items(
                service.low_stock(),
                args.json,
                render_low_stock,
                "no items need reordering",
            )
        if args.command == "value":
            total = service.total_value()
            if args.json:
                print(json.dumps({"total_value_cents": total}, sort_keys=True))
            else:
                print(format_cents(total))
            return 0

        item = service.get_item(args.sku) if args.command == "show" else service.adjust(
            args.sku, args.delta
        )
        if args.json:
            print(json.dumps(item.to_dict(), sort_keys=True))
        else:
            print(render_items([item]))
        return 0
    except NotFoundError as error:
        print(f"inventory: {error}", file=sys.stderr)
        return 2
    except InventoryError as error:
        print(f"inventory: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
