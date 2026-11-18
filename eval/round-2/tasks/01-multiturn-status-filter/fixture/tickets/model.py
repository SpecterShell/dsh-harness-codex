from dataclasses import dataclass


@dataclass(frozen=True)
class Ticket:
    id: str
    title: str
    status: str
    assignee: str | None
    priority: int


def from_dict(row):
    return Ticket(
        id=row["id"],
        title=row["title"],
        status=row["status"],
        assignee=row.get("assignee"),
        priority=int(row.get("priority", 3)),
    )
