from datetime import datetime, timedelta


def parse_ts(value):
    return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")


def window(start, hours):
    begin = parse_ts(start)
    return begin, begin + timedelta(hours=hours)


def in_window(ts, begin, end):
    return begin <= parse_ts(ts) <= end
