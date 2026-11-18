#!/usr/bin/env bash
# Check task 04: HTTP contract, clean lifecycle, written verification.
set -euo pipefail

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=${1:-$PWD}
[[ -d "$repo" ]] || { echo "no such work dir: $repo" >&2; exit 1; }
repo=$(cd -- "$repo" && pwd)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

cmp -s -- "$here/fixture/data/items.json" "$repo/data/items.json" \
  || fail "data/items.json changed; the API data is test input"

[[ -f "$repo/verification.md" ]] || fail "verification.md is missing"
for needle in "48173" "/health" "/api/items?limit=2" "status"; do
  grep -Fqi -- "$needle" "$repo/verification.md" \
    || fail "verification.md does not contain: $needle"
done
grep -Eiq -- '(SIGTERM|SIGINT|kill|Ctrl-C|stop(ped)?)' "$repo/verification.md" \
  || fail "verification.md does not say how the server was stopped"

# Nothing may be left listening on the task port.
if python3 - 48173 <<'PY'
import socket
import sys

sock = socket.socket()
sock.settimeout(0.5)
try:
    sock.connect(("127.0.0.1", int(sys.argv[1])))
except OSError:
    sys.exit(0)
finally:
    sock.close()
sys.exit(1)
PY
then
  :
else
  fail "a process is still listening on port 48173"
fi

there=$(mktemp -d "$repo/.round2-hidden.XXXXXX")
trap 'rm -rf -- "${there:?}"' EXIT
cp -- "$here/hidden/check-server.mjs" "$there/"

if ! (cd -- "$repo" && node --test); then
  fail "node --test failed"
fi

if ! (cd -- "$repo" && node "$there/check-server.mjs"); then
  fail "hidden server checks failed"
fi

echo "task 04 check passed"
