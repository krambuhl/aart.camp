#!/usr/bin/env bash
# learnings-post-session.sh — Stop hook for the learnings system.
#
# Three responsibilities:
#   1. Grep transcript for `Applied: L-\d+` lines → update citations.json.
#   2. Grep user messages for correction-starters → nudge (no auto-capture).
#   3. Append one line to sessions.jsonl with session metadata.
#
# This script is TRACKED in git but only runs if opted in via
# .claude/settings.local.json. See learnings/README.md for the snippet.
#
# Claude Code invokes Stop hooks with a JSON event on stdin containing at
# minimum { "session_id", "transcript_path", "cwd" }.
#
# Must stay fast (<500ms ideal) and must not fail the session on error.

set -u
# Intentionally NOT using `set -e` — any failure should be silent, never
# interrupt the user's session.

# --- locate paths ------------------------------------------------------------

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
if [ -z "${REPO_ROOT}" ] || [ ! -d "${REPO_ROOT}/learnings" ]; then
  exit 0
fi

LEARNINGS_DIR="${REPO_ROOT}/learnings"
CITATIONS="${LEARNINGS_DIR}/citations.json"
SESSIONS="${LEARNINGS_DIR}/sessions.jsonl"

# --- read event --------------------------------------------------------------

EVENT_JSON="$(cat 2>/dev/null || echo '{}')"

# Minimal JSON field extractor — only needs strings. Uses python3 if
# available, falls back to sed for hooks environments without it.
json_get() {
  local key="$1"
  local data="$2"
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "import json,sys
try:
  d=json.loads(sys.stdin.read())
  v=d.get('$key')
  print(v if v is not None else '')
except Exception:
  pass" <<< "$data"
  else
    # naive fallback — handles simple top-level string keys
    printf '%s' "$data" | sed -n 's/.*"'"$key"'"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1
  fi
}

SESSION_ID="$(json_get session_id "$EVENT_JSON")"
TRANSCRIPT="$(json_get transcript_path "$EVENT_JSON")"

if [ -z "$SESSION_ID" ]; then
  SESSION_ID="unknown-$(date +%s)"
fi

# --- responsibility 1: update citations.json --------------------------------
#
# Grep transcript for `Applied: L-NNN[, L-NNN]` patterns. Each matched id
# increments its count and sets last_used to today (UTC date).

USED_IDS=""
CITATION_COUNT=0
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  # Extract all L-NNN tokens that appear after `Applied:` anywhere in the file.
  USED_IDS="$(grep -oE 'Applied:[[:space:]]*L-[0-9]+(,[[:space:]]*L-[0-9]+)*' "$TRANSCRIPT" 2>/dev/null \
    | grep -oE 'L-[0-9]+' \
    | sort -u)"
  if [ -n "$USED_IDS" ]; then
    CITATION_COUNT=$(printf '%s\n' "$USED_IDS" | wc -l | tr -d ' ')
  fi
fi

# Idempotent JSON update via python3. If python3 unavailable, skip silently.
if [ -n "$USED_IDS" ] && command -v python3 >/dev/null 2>&1; then
  TODAY="$(date -u +%Y-%m-%d)"
  python3 - "$CITATIONS" "$TODAY" <<PY 2>/dev/null || true
import json, os, sys
path, today = sys.argv[1], sys.argv[2]
ids = [line.strip() for line in """$USED_IDS""".splitlines() if line.strip()]
data = {}
if os.path.exists(path):
    try:
        with open(path) as f: data = json.load(f)
    except Exception: data = {}
for lid in ids:
    entry = data.get(lid, {"count": 0, "last_used": None})
    entry["count"] = int(entry.get("count", 0)) + 1
    entry["last_used"] = today
    data[lid] = entry
os.makedirs(os.path.dirname(path), exist_ok=True)
tmp = path + ".tmp"
with open(tmp, "w") as f: json.dump(data, f, indent=2, sort_keys=True)
os.replace(tmp, path)
PY
fi

# --- responsibility 2: nudge on corrections ---------------------------------
#
# Grep user turns for correction-starters. Only considers lines that look like
# user messages in the transcript. Print a nudge to stderr — no auto-capture.

CORRECTION_COUNT=0
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  # Heuristic: Claude Code transcripts are JSONL with role markers. Use
  # python3 to walk them if available; otherwise fall back to a naive grep.
  if command -v python3 >/dev/null 2>&1; then
    CORRECTION_COUNT="$(python3 - "$TRANSCRIPT" <<'PY' 2>/dev/null || echo 0
import json, re, sys
path = sys.argv[1]
pattern = re.compile(r"^\s*(no,?|actually|don't|dont|instead|prefer)\b", re.IGNORECASE)
count = 0
try:
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line: continue
            try: obj = json.loads(line)
            except Exception: continue
            role = obj.get("role") or (obj.get("message", {}) or {}).get("role")
            if role != "user": continue
            content = obj.get("content") or (obj.get("message", {}) or {}).get("content") or ""
            if isinstance(content, list):
                content = " ".join(
                    (c.get("text", "") if isinstance(c, dict) else str(c))
                    for c in content
                )
            for chunk in str(content).splitlines():
                if pattern.match(chunk):
                    count += 1
                    break
except Exception:
    pass
print(count)
PY
)"
  else
    CORRECTION_COUNT="$(grep -ciE "^[[:space:]]*(no,?|actually|don'?t|instead|prefer)\b" "$TRANSCRIPT" 2>/dev/null || echo 0)"
  fi
fi

if [ "${CORRECTION_COUNT:-0}" -gt 0 ] 2>/dev/null; then
  printf '🧠 Detected %s correction(s) this session — consider /learnings-capture\n' "$CORRECTION_COUNT" >&2
fi

# --- responsibility 3: append sessions.jsonl --------------------------------

# Duration: Claude Code doesn't pass us a start time directly. If the event
# JSON has one, use it; otherwise leave 0. Token counts similarly best-effort.
DURATION_MS="$(json_get duration_ms "$EVENT_JSON")"
DURATION_MS="${DURATION_MS:-0}"
TOKENS_ADDED="$(json_get tokens_added_by_rollup "$EVENT_JSON")"
TOKENS_ADDED="${TOKENS_ADDED:-0}"

USED_IDS_JSON="[]"
if [ -n "$USED_IDS" ] && command -v python3 >/dev/null 2>&1; then
  USED_IDS_JSON="$(python3 -c "
import json, sys
ids = [l.strip() for l in '''$USED_IDS'''.splitlines() if l.strip()]
print(json.dumps(sorted(set(ids))))
")"
fi

mkdir -p "$LEARNINGS_DIR"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if command -v python3 >/dev/null 2>&1; then
  LINE="$(python3 -c "
import json
print(json.dumps({
  'id': '$SESSION_ID',
  'timestamp': '$TS',
  'duration_ms': int('$DURATION_MS' or 0),
  'corrections': int('$CORRECTION_COUNT' or 0),
  'used_learnings': json.loads('$USED_IDS_JSON' or '[]'),
  'citations': int('$CITATION_COUNT' or 0),
  'tokens_added_by_rollup': int('$TOKENS_ADDED' or 0),
}))
")"
  printf '%s\n' "$LINE" >> "$SESSIONS" 2>/dev/null || true
fi

exit 0
