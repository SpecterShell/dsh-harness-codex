import argparse
import json
import sys
from pathlib import Path

from .service import TicketService
from .store import load_tickets

DATA = Path(__file__).resolve().parent.parent / "data" / "tickets.json"


def as_json(value):
    print(json.dumps(value, indent=2))


def format_table(tickets):
    width = max([len(t.id) for t in tickets] + [2])
    lines = [f"{'ID':<{width}}  {'STATUS':<12}  {'ASSIGNEE':<8}  TITLE"]
    for ticket in tickets:
        lines.append(
            f"{ticket.id:<{width}}  {ticket.status:<12}  "
            f"{ticket.assignee or '-':<8}  {ticket.title}"
        )
    return "\n".join(lines)


def build_parser():
    parser = argparse.ArgumentParser(prog="ticketctl")
    parser.add_argument("--data", default=str(DATA))
    sub = parser.add_subparsers(dest="command", required=True)

    list_cmd = sub.add_parser("list")
    list_cmd.add_argument("--assignee")
    list_cmd.add_argument("--json", action="store_true")

    count_cmd = sub.add_parser("count")
    count_cmd.add_argument("--assignee")
    count_cmd.add_argument("--json", action="store_true")

    show_cmd = sub.add_parser("show")
    show_cmd.add_argument("ticket_id")

    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    service = TicketService(load_tickets(args.data))

    if args.command == "list":
        tickets = service.tickets(assignee=args.assignee)
        if args.json:
            as_json([ticket.__dict__ for ticket in tickets])
        else:
            print(format_table(tickets))
    elif args.command == "count":
        value = service.count(assignee=args.assignee)
        if args.json:
            as_json({"count": value})
        else:
            print(f"{value} tickets")
    elif args.command == "show":
        ticket = service.get(args.ticket_id)
        as_json(ticket.__dict__)
    return 0


if __name__ == "__main__":
    sys.exit(main())
