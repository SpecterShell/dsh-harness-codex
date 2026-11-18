import re
from dataclasses import dataclass

LINE = re.compile(
    r'^(?P<ts>\S+) level=(?P<level>[A-Z]+) service=(?P<service>\S+) '
    r'job=(?P<job>\S+) attempt=(?P<attempt>\d+) duration_ms=(?P<duration>\d+) '
    r'msg="(?P<msg>.*)"$'
)


@dataclass(frozen=True)
class Entry:
    ts: str
    level: str
    service: str
    job: str
    attempt: int
    duration_ms: int
    msg: str


def parse_line(line):
    line = line.rstrip("\n")
    if not line.strip():
        return None
    fields = {}
    for part in line.split(" "):
        if "=" in part:
            key, value = part.split("=", 1)
            fields[key] = value
    ts = fields.get("ts") or line.split(" ", 1)[0]
    return Entry(
        ts=ts,
        level=fields.get("level", "INFO"),
        service=fields.get("service", "unknown"),
        job=fields.get("job", "unknown"),
        attempt=int(fields.get("attempt", "1")),
        duration_ms=int(fields.get("duration_ms", "0")),
        msg=fields.get("msg", "").strip('"'),
    )


def parse_file(path):
    entries = []
    skipped = 0
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            entry = parse_line(line)
            if entry is None:
                skipped += 1
            else:
                entries.append(entry)
    return entries, skipped
