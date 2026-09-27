"""
Convert an existing timetable_raw.json (produced by `scrape_timetable_auth.py
--debug-dump-raw`) into a raw_classes.csv that matches the RawTimings
schema. Use this to avoid re-scraping when you already have a JSON dump.

Run:
    python scripts/raw_json_to_csv.py \
        --input  scripts/debug/timetable_raw.json \
        --output public/raw_classes.csv
"""

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List


RAW_CSV_FIELDS = [
    "SubCode",
    "SubName",
    "Type",
    "TypeWithSection",
    "TypeFull",
    "SelectionOption",
    "Day",
    "StartTime",
    "EndTime",
    "Location",
    "Lecturer",
    "SemesterId",
]


def normalize_whitespace(value: Any) -> str:
    if not isinstance(value, str):
        return "" if value is None else str(value)
    return " ".join(value.split())


def format_time_hhmm(value: Any) -> str:
    if not value:
        return ""
    s = normalize_whitespace(value)
    # Portal already emits "HH:mm". Just sanity-check the shape.
    if len(s) == 5 and s[2] == ":":
        return s
    return s


def iter_rows(entries: Iterable[Dict[str, Any]]) -> Iterable[Dict[str, str]]:
    for entry in entries:
        if not (entry.get("subject_code") and entry.get("week_day")):
            continue
        sub_code = normalize_whitespace(entry.get("subject_code", "")).replace(" ", "")
        sem_id = entry.get("semester_id")
        sem_id_str = str(sem_id) if sem_id is not None else ""

        yield {
            "SubCode":         sub_code,
            "SubName":         normalize_whitespace(entry.get("subject_name_full", "") or entry.get("subject_name", "")),
            "Type":            normalize_whitespace(entry.get("type", "")),
            "TypeWithSection": normalize_whitespace(entry.get("type_with_section", "")),
            "TypeFull":        normalize_whitespace(entry.get("type_full", "")),
            "SelectionOption": normalize_whitespace(entry.get("subject_selection_option", "")),
            "Day":             normalize_whitespace(entry.get("week_day", "")),
            "StartTime":       format_time_hhmm(entry.get("start_time")),
            "EndTime":         format_time_hhmm(entry.get("end_time")),
            "Location":        normalize_whitespace(entry.get("location", "")),
            "Lecturer":        normalize_whitespace(entry.get("lecturer", "")),
            "SemesterId":      sem_id_str,
        }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert timetable_raw.json into raw_classes.csv",
    )
    parser.add_argument(
        "--input", type=Path,
        default=Path("scripts/debug/timetable_raw.json"),
        help="Path to timetable_raw.json (default: scripts/debug/timetable_raw.json)",
    )
    parser.add_argument(
        "--output", type=Path,
        default=Path("public/raw_classes.csv"),
        help="Path to write raw_classes.csv (default: public/raw_classes.csv)",
    )
    args = parser.parse_args()

    if not args.input.is_file():
        print(f"Error: input file not found: {args.input}", file=sys.stderr)
        return 1

    print(f"Reading {args.input} ...")
    data = json.loads(args.input.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        print("Error: expected a JSON array at the top level", file=sys.stderr)
        return 1

    rows: List[Dict[str, str]] = list(iter_rows(data))
    if not rows:
        print("Error: no usable rows extracted from JSON", file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    tmp = args.output.with_suffix(args.output.suffix + ".tmp")
    with tmp.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=RAW_CSV_FIELDS,
            quoting=csv.QUOTE_MINIMAL,
        )
        writer.writeheader()
        writer.writerows(rows)
    tmp.replace(args.output)

    print(f"Wrote {len(rows)} rows -> {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
