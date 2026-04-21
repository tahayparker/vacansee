"""
Schedule gate — decides whether to run the scraper now.

Reads `public/academic_schedule.json` (produced by update_schedule.py).

Rules:
  * Peak = current UTC date falls inside any semester's [peak_start, peak_end].
  * Trigger "manual"  (workflow_dispatch)     → always run.
  * Trigger "daily"   (daily cron)            → always run + refresh calendar.
  * Trigger "15min"   (15-minute cron)        → run only if peak.
  * Anything else                             → run.

Exit 0 if should run, 78 if should skip (78 = POSIX "configuration error",
useful as a neutral signal; the workflow maps it to an early exit step).

Prints key=value lines suitable for $GITHUB_OUTPUT:
  should_run=true|false
  is_peak=true|false
  trigger=<classified>
  current_semester=<name or "">
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
from pathlib import Path


SCHEDULE_PATH = Path("public/academic_schedule.json")


def classify_trigger(event_name: str, schedule: str) -> str:
    if event_name == "workflow_dispatch":
        return "manual"
    if event_name == "schedule":
        # Every 15 min crons:  */15 * * * *
        if "*/15" in schedule:
            return "15min"
        return "daily"
    return "other"


def load_peaks() -> list[tuple[datetime.date, datetime.date, str]]:
    if not SCHEDULE_PATH.exists():
        return []
    try:
        data = json.loads(SCHEDULE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []
    out = []
    for s in data.get("semesters", []):
        try:
            ps = datetime.date.fromisoformat(s["peak_start"])
            pe = datetime.date.fromisoformat(s["peak_end"])
            out.append((ps, pe, s.get("name", "")))
        except Exception:
            continue
    return out


def find_active_peak(today: datetime.date, peaks) -> tuple[bool, str]:
    for ps, pe, name in peaks:
        if ps <= today <= pe:
            return True, name
    return False, ""


def emit(key: str, value: str) -> None:
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as fh:
            fh.write(f"{key}={value}\n")
    print(f"{key}={value}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--event", default=os.environ.get("GITHUB_EVENT_NAME", "workflow_dispatch"))
    parser.add_argument("--schedule", default=os.environ.get("GITHUB_SCHEDULE", ""))
    args = parser.parse_args()

    trigger = classify_trigger(args.event, args.schedule)
    peaks = load_peaks()
    today = datetime.datetime.now(datetime.timezone.utc).date()
    is_peak, sem = find_active_peak(today, peaks)

    if trigger == "15min" and not is_peak:
        should_run = False
    else:
        should_run = True

    emit("trigger", trigger)
    emit("is_peak", "true" if is_peak else "false")
    emit("current_semester", sem)
    emit("should_run", "true" if should_run else "false")

    print(f"[gate] today={today} trigger={trigger} is_peak={is_peak} sem={sem!r} run={should_run}", flush=True)
    return 0 if should_run else 78


if __name__ == "__main__":
    sys.exit(main())
