"""Hidden behaviour check for task 01. Run with the repository as cwd."""
import json
import subprocess
import sys


def cli(*args):
    result = subprocess.run(
        [sys.executable, "-m", "tickets.cli", *args],
        text=True,
        capture_output=True,
        env={"PYTHONDONTWRITEBYTECODE": "1", "PATH": "/usr/bin:/bin"},
    )
    if result.returncode != 0:
        raise SystemExit(f"command failed: {' '.join(args)}\n{result.stderr}")
    return result.stdout


def payload(*args):
    return json.loads(cli(*args))


def ids(*args):
    return [ticket["id"] for ticket in payload("list", "--json", *args)]


assert ids() == [
    "TCK-101", "TCK-102", "TCK-103", "TCK-104",
    "TCK-105", "TCK-106", "TCK-107", "TCK-108",
], ids()
assert set(payload("list", "--json")[0]) == {
    "id", "title", "status", "assignee", "priority"
}, payload("list", "--json")[0]

assert ids("--status", "open") == ["TCK-101", "TCK-102", "TCK-105"], ids("--status", "open")
assert ids("--status", "  OPEN  ") == ["TCK-101", "TCK-102", "TCK-105"], ids("--status", "  OPEN  ")
assert ids("--status", "blocked") == ["TCK-103", "TCK-106"], ids("--status", "blocked")
assert ids("--status", "in progress") == ["TCK-104", "TCK-108"], ids("--status", "in progress")
assert ids("--status", "open, blocked") == [
    "TCK-101", "TCK-102", "TCK-103", "TCK-105", "TCK-106"
], ids("--status", "open, blocked")
assert ids("--status", "OPEN,In Progress") == [
    "TCK-101", "TCK-102", "TCK-104", "TCK-105", "TCK-108"
], ids("--status", "OPEN,In Progress")
assert ids("--status", "done") == ["TCK-107"], ids("--status", "done")
assert ids("--status", "archived") == [], ids("--status", "archived")
assert ids("--assignee", "mira", "--status", "blocked") == [
    "TCK-103", "TCK-106"
], ids("--assignee", "mira", "--status", "blocked")

assert payload("count", "--json") == {"count": 8}, payload("count", "--json")
assert payload("count", "--json", "--status", "open") == {"count": 3}, payload("count", "--json", "--status", "open")
assert payload("count", "--json", "--status", "open,blocked") == {"count": 5}, payload(
    "count", "--json", "--status", "open,blocked")
assert payload("count", "--json", "--status", "archived") == {"count": 0}, payload(
    "count", "--json", "--status", "archived")
assert cli("count", "--status", "open").strip() == "3 tickets", cli("count", "--status", "open")
print("hidden filter checks ok")
