#!/usr/bin/env bash
# Runs tests.html in headless Microsoft Edge and prints the summary line.
# Exit 0 only when the summary starts with PASS.
set -u
here="$(cd "$(dirname "$0")" && pwd -W 2>/dev/null || pwd)"
edge="${EDGE:-/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe}"
profile="$(mktemp -d)"
dom=$("$edge" --headless --disable-gpu --no-first-run --user-data-dir="$profile" \
  --virtual-time-budget=10000 --dump-dom "file:///${here}/tests.html" 2>/dev/null)
rm -rf "$profile"
summary=$(printf '%s' "$dom" | tr -d '\r' | grep -o '<div id="summary"[^>]*>[^<]*' | sed 's/.*>//')
failures=$(printf '%s' "$dom" | grep -o '<li class="fail">[^<]*' | sed 's/.*>/  FAIL: /')
echo "${summary:-NO SUMMARY (page did not run)}"
[ -n "$failures" ] && echo "$failures"
case "$summary" in PASS*) exit 0 ;; *) exit 1 ;; esac
