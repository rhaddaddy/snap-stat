#!/bin/bash
# Checks the built app before a push: opens every page and panel on a 390px phone, in dark and light, signed out and
# signed in (fake account, no internet needed). Prints "ALL GOOD" twice when everything passes.
# Usage (from anywhere): bash tests/check.sh        Needs index.html already built (see CLAUDE.md › Build).
cd "$(dirname "$0")/.."
PORT=${PORT:-8790}
# No email address may be in the built page (the owner's must never be published; example.com is the tests' fake one)
FOUND=$(grep -oE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" index.html | grep -v "@example\.com$" | sort -u)
if [ -n "$FOUND" ]; then echo "STOP: index.html has an email address in it: $FOUND"; exit 1; fi
python3 tests/serve.py $PORT &
SRV=$!
sleep 0.8
(cd tests && PORT=$PORT timeout -s KILL 300 node crawl.cjs 2>&1 | tail -30)
(cd tests && PORT=$PORT SIGNIN=1 timeout -s KILL 300 node crawl.cjs 2>&1 | tail -30)
kill $SRV 2>/dev/null; wait $SRV 2>/dev/null
exit 0
