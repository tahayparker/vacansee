"""
Scrape UOWD academic calendar → write `public/academic_schedule.json`.

Produces peak windows used by the timetable scraper to decide when to run
on the 15-minute cron vs. the daily cron.

Peak window = (tutorial-enrolment start date - 14 days) .. (last-date-to-enrol)
Tutorial enrolment row matches "Enrolment in Lectures" or "Enrolment Opens".
Last-enrol row matches "Last Date to Enrol" / "Last Date to Enroll".
"""

from __future__ import annotations

import datetime
import json
import re
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional

from bs4 import BeautifulSoup
from camoufox.sync_api import Camoufox

CALENDAR_URL = "https://www.uowdubai.ac.ae/students/academic-calendar"
OUTPUT_PATH  = Path("public/academic_schedule.json")
PEAK_LEAD_DAYS = 14

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7, "aug": 8,
    "sept": 9, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

ENROL_START_RE = re.compile(r"Enrolment\s+in\s+Lectures|Enrolment\s+Opens", re.I)
ENROL_LAST_RE  = re.compile(r"Last\s+Date\s+to\s+Enrol", re.I)  # matches Enrol/Enroll
FINAL_EXAM_RE  = re.compile(r"Final\s+Examinations|Summer\s+Examinations", re.I)


def log(tag: str, msg: str, ok: bool = True) -> None:
    icon = "OK " if ok else "ERR"
    print(f"[{tag}] {icon} {msg}", flush=True)


def fetch_calendar_html() -> str:
    log("FETCH", f"GET {CALENDAR_URL}")
    with Camoufox(headless=True, humanize=True, geoip=True, i_know_what_im_doing=True) as br:
        ctx = br.new_context(locale="en-US")
        ctx.set_default_navigation_timeout(60_000)
        p = ctx.new_page()
        p.goto(CALENDAR_URL, wait_until="domcontentloaded")
        for _ in range(10):
            t = (p.title() or "").lower()
            if "just a moment" not in t and "challenge" not in t:
                break
            time.sleep(2)
        # Let table render fully
        try:
            p.wait_for_selector("ul.tab-container", timeout=30_000)
        except Exception:
            pass
        time.sleep(2)
        return p.content()


def _strip(s: str) -> str:
    return " ".join(s.replace("\xa0", " ").split())


def parse_first_date(text: str) -> Optional[datetime.date]:
    """
    Extract the first date from strings like:
      "Mon, 17 November 2025"
      "Thu, 18 – Fri, 19 December 2025 (5pm)"
      "Mon, 15 June 2026 (5:00pm)"
    The *anchor* month+year comes from the last full occurrence in the string.
    """
    text = _strip(text)
    pat = re.compile(
        r"(?P<day>\d{1,2})\s+(?P<month>[A-Za-z]+)\s+(?P<year>\d{4})"
    )
    anchors = list(pat.finditer(text))
    if not anchors:
        return None
    a = anchors[-1]
    month = MONTHS.get(a.group("month").lower().rstrip("."))
    year  = int(a.group("year"))
    if not month:
        return None

    # First day number in the string (might be earlier than the anchor)
    m = re.search(r"\b(\d{1,2})\b", text)
    if not m:
        return None
    day = int(m.group(1))
    # If first day > last day in anchor, it belongs to the previous month.
    try:
        return datetime.date(year, month, day)
    except ValueError:
        return None


def parse_last_date(text: str) -> Optional[datetime.date]:
    """Parse the last date appearing in the cell (for ranges like 'A – B')."""
    text = _strip(text)
    pat = re.compile(
        r"(?P<day>\d{1,2})\s+(?P<month>[A-Za-z]+)\s+(?P<year>\d{4})"
    )
    matches = list(pat.finditer(text))
    if not matches:
        return None
    m = matches[-1]
    month = MONTHS.get(m.group("month").lower().rstrip("."))
    if not month:
        return None
    try:
        return datetime.date(int(m.group("year")), month, int(m.group("day")))
    except ValueError:
        return None


def parse_semesters(html: str) -> List[Dict]:
    """Return list of {name, peak_start (iso), peak_end (iso)} entries."""
    soup = BeautifulSoup(html, "html.parser")
    tabs = soup.select("ul.tab-container a.nav-link")
    # Panels have ids tab1..tab4 and their labels come from the tab anchors.
    labels = {}
    for a in tabs:
        href = a.get("href", "")
        if href.startswith("#"):
            labels[href[1:]] = _strip(a.text)

    parsed: List[Dict] = []
    for panel_id, label in labels.items():
        panel = soup.select_one(f"#{panel_id}")
        if not panel:
            continue
        rows = panel.select("table tr")
        enrol_start: Optional[datetime.date] = None
        enrol_last:  Optional[datetime.date] = None
        final_start: Optional[datetime.date] = None
        for row in rows:
            cells = row.find_all("td")
            if len(cells) < 2:
                continue
            date_txt = _strip(cells[0].get_text(" "))
            activity = _strip(cells[1].get_text(" "))
            if enrol_start is None and ENROL_START_RE.search(activity):
                enrol_start = parse_first_date(date_txt)
            if enrol_last is None and ENROL_LAST_RE.search(activity):
                enrol_last = parse_last_date(date_txt)
            if final_start is None and FINAL_EXAM_RE.search(activity):
                final_start = parse_first_date(date_txt)
        if enrol_start and enrol_last:
            parsed.append({
                "name": label,
                "enrolment_start":  enrol_start,
                "enrolment_last":   enrol_last,
                "final_exam_start": final_start,
                "peak_start_raw":   enrol_start - datetime.timedelta(days=PEAK_LEAD_DAYS),
            })
        else:
            log("PARSE", f"{label}: missing dates (start={enrol_start}, last={enrol_last})", ok=False)

    # Sort chronologically by enrolment_start so "previous" is well-defined.
    parsed.sort(key=lambda s: s["enrolment_start"])

    # Clamp peak_start to not begin before the previous semester's first
    # final exam. Before that date the previous semester is still the
    # active one on vacansee, so scraping its (stable) data every 15 min
    # would be pointless — and scraping the new semester early risks
    # overwriting current data.
    semesters: List[Dict] = []
    prev_final: Optional[datetime.date] = None
    for s in parsed:
        peak_start = s["peak_start_raw"]
        if prev_final and peak_start < prev_final:
            peak_start = prev_final
        semesters.append({
            "name":             s["name"],
            "enrolment_start":  s["enrolment_start"].isoformat(),
            "enrolment_last":   s["enrolment_last"].isoformat(),
            "final_exam_start": s["final_exam_start"].isoformat() if s["final_exam_start"] else None,
            "peak_start":       peak_start.isoformat(),
            "peak_end":         s["enrolment_last"].isoformat(),
        })
        if s["final_exam_start"]:
            prev_final = s["final_exam_start"]
    return semesters


def main() -> int:
    try:
        html = fetch_calendar_html()
    except Exception as exc:
        log("FETCH", f"failed: {exc}", ok=False)
        return 1

    semesters = parse_semesters(html)
    if not semesters:
        log("PARSE", "no semesters parsed", ok=False)
        return 1

    payload = {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "semesters": semesters,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    for s in semesters:
        log("SEM", f"{s['name']}: peak {s['peak_start']} → {s['peak_end']}")
    log("OUT", f"wrote {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
