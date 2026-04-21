"""
Authenticated UOWD Timetable Scraper
─────────────────────────────────────

Stealth stack with auto-fallback:
  1. Camoufox   (Firefox fork, C++ fingerprint spoof — primary)
  2. Patchright (patched Chromium Playwright — secondary)
  3. Embedded Turnstile auto-click (click widget via iframe — last resort)

Starts at portal root (my.uowdubai.ac.ae/) so we don't hit the raw
/timetable/viewer restricted page with a cold CF challenge. After login via
MS OAuth, we reuse the same authed session to fetch the viewer.

Session cookies (MS SSO + cf_clearance) are persisted to
`.storage_state.json`. On next run we restore them and skip login entirely.
Caches this file via `actions/cache` in the workflow.

Env vars required:
    UOWD_EMAIL
    UOWD_PASSWORD
    UOWD_TOTP_SECRET
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY

Usage:
    python scripts/scrape_timetable_auth.py --output public/classes.csv
"""

# pylint: disable=broad-except,too-many-branches,too-many-statements,too-many-locals

from __future__ import annotations

import argparse
import csv
import datetime
import json
import os
import re
import sys
import time
import traceback
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Tuple

import pyotp
from dotenv import load_dotenv
from postgrest.exceptions import APIError

from db_connection import get_supabase_client

load_dotenv()
load_dotenv(".env.local", override=True)

# ── Constants ────────────────────────────────────────────────────────────────

PORTAL_URL     = "https://my.uowdubai.ac.ae/"
VIEWER_URL     = "https://my.uowdubai.ac.ae/timetable/viewer"
UOWD_HOST      = "my.uowdubai.ac.ae"
MS_LOGIN_HOST  = "login.microsoftonline.com"
MS_LIVE_HOST   = "login.live.com"

STORAGE_STATE_PATH = Path(".storage_state.json")
SCHEDULE_PATH      = Path("public/academic_schedule.json")
DEBUG_DIR          = Path("scripts/debug")

DEFAULT_TIMEOUT_MS = 30_000
NAV_TIMEOUT_MS     = 60_000
LOGIN_MAX_STEPS    = 25
CF_SETTLE_SEC      = 6


# ── Utilities ────────────────────────────────────────────────────────────────

def log(tag: str, msg: str, ok: bool = True) -> None:
    icon = "✓" if ok else "✗"
    print(f"[{tag}] {icon} {msg}", flush=True)


def normalize_whitespace(text: Optional[str]) -> str:
    if not isinstance(text, str):
        return ""
    return " ".join(text.split())


def format_time_hhmm(time_str: Optional[str]) -> str:
    if not time_str:
        return ""
    norm = normalize_whitespace(time_str)
    try:
        return datetime.datetime.strptime(norm, "%H:%M").strftime("%H:%M")
    except ValueError:
        return norm


def current_semester() -> str:
    """
    The semester whose final exams have NOT yet started.
    Reads public/academic_schedule.json (populated by update_schedule.py).
    Picks the semester with the smallest `final_exam_start` date that is
    strictly in the future — the current semester only ends when its first
    final exam begins. Falls back to a crude month-based heuristic if the
    schedule cache is absent.
    """
    today = datetime.date.today()
    if SCHEDULE_PATH.exists():
        try:
            data = json.loads(SCHEDULE_PATH.read_text(encoding="utf-8"))
            candidates = []
            for s in data.get("semesters", []):
                fes = s.get("final_exam_start")
                if not fes:
                    continue
                try:
                    d = datetime.date.fromisoformat(fes)
                except ValueError:
                    continue
                if d >= today:
                    candidates.append((d, s["name"]))
            if candidates:
                candidates.sort(key=lambda x: x[0])
                return candidates[0][1]
            # All finals passed — fall back to latest semester listed
            sems = data.get("semesters", [])
            if sems:
                return sems[-1].get("name", "")
        except Exception as exc:
            log("SEM", f"schedule cache unreadable: {exc}", ok=False)

    # Fallback: crude month-based heuristic
    now = datetime.datetime.now()
    y, m, w = now.year, now.month, (now.day - 1) // 7 + 1
    if m in (1, 2):       return f"Winter {y}"
    if m == 3:            return f"Winter {y}" if w <= 3 else f"Spring {y}"
    if m in (4, 5, 6):    return f"Spring {y}"
    if m == 7:            return f"Summer {y}"
    if m == 8:            return f"Summer {y}" if w <= 2 else f"Autumn {y}"
    if m in (9, 10, 11):  return f"Autumn {y}"
    if m == 12:           return f"Autumn {y}" if w <= 1 else f"Winter {y}"
    return "Unknown"


def totp_code(secret: str) -> str:
    return pyotp.TOTP(secret).now()


def shot(page, tag: str) -> None:
    try:
        DEBUG_DIR.mkdir(parents=True, exist_ok=True)
        p = DEBUG_DIR / f"{int(time.time())}_{tag}.png"
        try:
            page.screenshot(path=str(p), full_page=True)
        except Exception:
            # Some pages (e.g. viewer) exceed 32767px height. Fall back to viewport.
            page.screenshot(path=str(p), full_page=False)
        # URL intentionally omitted from log — it can contain auth codes.
        log("SHOT", f"{p.name}")
    except Exception as exc:
        log("SHOT", f"failed: {exc}", ok=False)


# ── Supabase ─────────────────────────────────────────────────────────────────

def init_supabase():
    try:
        client = get_supabase_client()
        log("SUPABASE", "Connected (service role).")
        return client
    except Exception as exc:
        log("SUPABASE", f"Init failed: {exc}", ok=False)
        sys.exit(1)


def fetch_room_mapping(supabase) -> Dict[str, str]:
    log("ROOMS", "Fetching room mapping…")
    try:
        resp = (
            supabase.table("Rooms")
            .select("Name, ShortCode")
            .neq("Name", "%Consultation%")
            .neq("Name", "%Online%")
            .execute()
        )
        raw: Dict[str, str] = {}
        for row in resp.data or []:
            sc = normalize_whitespace(row.get("ShortCode", ""))
            nm = normalize_whitespace(row.get("Name", ""))
            if sc and nm:
                raw[sc] = nm
        mapping = {k: raw[k] for k in sorted(raw, key=len, reverse=True)}
        log("ROOMS", f"{len(mapping)} entries loaded.")
        return mapping
    except APIError as exc:
        log("ROOMS", f"API error: {exc}", ok=False)
    except Exception as exc:
        log("ROOMS", f"Unexpected error: {exc}", ok=False)
    return {}


def resolve_room(loc: str, mapping: Dict[str, str]) -> str:
    for sc, name in mapping.items():
        if loc.startswith(sc):
            return name
    return loc


# ── Page-state helpers ───────────────────────────────────────────────────────

def is_cloudflare_page(page) -> bool:
    try:
        title = (page.title() or "").lower()
        if "just a moment" in title or "challenge" in title:
            return True
        if page.locator("iframe[src*='challenges.cloudflare.com']").count() > 0:
            return True
        if page.locator("#challenge-stage, .cf-turnstile").count() > 0:
            return True
    except Exception:
        pass
    return False


def wait_for_cf_clear(page, timeout_sec: int = 30) -> bool:
    """Passive wait — most stealth stacks auto-pass CF in a few seconds."""
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        if not is_cloudflare_page(page):
            return True
        time.sleep(1)
    return False


def try_click_turnstile(page) -> bool:
    """
    Last-resort Turnstile auto-click.
    Works by finding the CF challenge iframe and clicking its center.
    """
    try:
        frame_el = page.locator("iframe[src*='challenges.cloudflare.com']").first
        if not frame_el.count():
            return False
        box = frame_el.bounding_box()
        if not box:
            return False
        # Click the checkbox (~30px from left of the widget, middle vertically).
        x = box["x"] + 30
        y = box["y"] + box["height"] / 2
        page.mouse.move(x - 20, y - 10, steps=8)
        time.sleep(0.3)
        page.mouse.move(x, y, steps=6)
        page.mouse.click(x, y, delay=80)
        return True
    except Exception as exc:
        log("TURNSTILE", f"click err: {exc}", ok=False)
        return False


def handle_cloudflare(page, attempts: int = 2) -> bool:
    if not is_cloudflare_page(page):
        return True
    log("CF", "Turnstile/challenge detected — waiting for auto-pass…")
    if wait_for_cf_clear(page, timeout_sec=20):
        log("CF", "Cleared passively.")
        return True
    for i in range(attempts):
        log("CF", f"Attempting manual iframe click (try {i + 1}/{attempts})…")
        if try_click_turnstile(page):
            if wait_for_cf_clear(page, timeout_sec=15):
                log("CF", "Cleared after click.")
                return True
        try:
            page.reload(wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
        except Exception:
            pass
        if wait_for_cf_clear(page, timeout_sec=15):
            log("CF", "Cleared after reload.")
            return True
    log("CF", "Could not clear challenge.", ok=False)
    return False


# ── Login state machine ──────────────────────────────────────────────────────

class LoginFlow:
    def __init__(self, page, email: str, password: str, totp_secret: str):
        self.page = page
        self.email = email
        self.password = password
        self.totp_secret = totp_secret
        self._unknown_count = 0

    def run(self) -> bool:
        log("LOGIN", f"Navigating to portal {PORTAL_URL}")
        self.page.goto(PORTAL_URL, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
        time.sleep(CF_SETTLE_SEC)
        handle_cloudflare(self.page)
        shot(self.page, "portal_landed")

        for step in range(1, LOGIN_MAX_STEPS + 1):
            state = self._detect()
            # URL intentionally omitted — post-OAuth it contains auth codes
            # that CodeQL flags as sensitive (py/clear-text-logging-
            # sensitive-data). State alone is enough to trace flow.
            log("LOGIN", f"step {step:02d} | state={state}")

            if state == "DONE":
                log("LOGIN", "Authenticated at portal ✅")
                return True
            if state == "ERROR":
                log("LOGIN", "Unrecoverable.", ok=False)
                return False

            handler = getattr(self, f"_h_{state.lower()}", None)
            if handler is None:
                log("LOGIN", f"No handler for '{state}'", ok=False)
                return False

            try:
                handler()
            except Exception as exc:
                log("LOGIN", f"handler {state!r} raised: {exc}", ok=False)
                traceback.print_exc()
                shot(self.page, f"err_{state.lower()}")
                return False

            time.sleep(1.5)

        log("LOGIN", f"exceeded {LOGIN_MAX_STEPS} steps", ok=False)
        return False

    # ── detection ──

    def _detect(self) -> str:
        try:
            url = self.page.url or ""
            title = (self.page.title() or "").lower()
        except Exception:
            return "ERROR"

        if "just a moment" in title or is_cloudflare_page(self.page):
            return "CLOUDFLARE"

        if MS_LOGIN_HOST in url or MS_LIVE_HOST in url:
            # MS pages disambiguated by placeholder text, not input type —
            # the password page also renders a hidden email stub.
            # Email: placeholder "someone@example.com"
            # Password: placeholder "Password" + "Enter password" heading + "Forgot my password" link
            # TOTP: placeholder/pattern for 6-digit code, "Enter code" heading
            if self._present("input[placeholder='someone@example.com']"):
                return "EMAIL"
            if (self._text_on_page("Enter code")
                    or self._text_on_page("verification code")
                    or self._present("input[name='otc']")
                    or self._present("input[id*='OTC']")):
                return "TOTP"
            if (self._present("input[placeholder='Password']")
                    or self._text_on_page("Forgot my password")
                    or self._text_on_page("Enter password")):
                return "PASSWORD"
            if (self._present("input[value='Yes']")
                    or self._text_on_page("Stay signed in")):
                return "STAYLOGGEDIN"
            return "MS_TRANSITION"

        if UOWD_HOST in url:
            # Timetable viewer ready to scrape
            if "timetable" in url.lower() and self._present("input[type='radio']", timeout=2):
                return "DONE"
            if self._text_on_page("Timetable Viewer is restricted"):
                return "RESTRICTED"
            if self._has_login_button():
                return "LOGINBUTTON"
            # On portal with no Login button → we're authenticated.
            return "DONE"

        return "UNKNOWN"

    def _present(self, selector: str, timeout: float = 1.0) -> bool:
        try:
            loc = self.page.locator(selector).first
            if not loc.count():
                return False
            return loc.is_visible(timeout=int(timeout * 1000))
        except Exception:
            return False

    def _text_on_page(self, text: str) -> bool:
        try:
            return self.page.get_by_text(text, exact=False).first.is_visible(timeout=1000)
        except Exception:
            return False

    def _has_login_button(self) -> bool:
        for sel in [
            "button.btn-danger:has-text('Login')",
            "button:has-text('Login')",
            "a:has-text('Login')",
            "button:has-text('Sign in')",
        ]:
            if self._present(sel, timeout=1):
                return True
        return False

    # ── handlers ──

    def _h_cloudflare(self) -> None:
        handle_cloudflare(self.page)

    def _h_restricted(self) -> None:
        log("LOGIN", "restricted → clicking 'here'")
        for sel in ["a:has-text('here')", "text=here"]:
            try:
                loc = self.page.locator(sel).first
                if loc.count() and loc.is_visible():
                    loc.click()
                    self.page.wait_for_load_state("domcontentloaded", timeout=NAV_TIMEOUT_MS)
                    time.sleep(2)
                    handle_cloudflare(self.page)
                    return
            except Exception:
                continue

    def _h_loginbutton(self) -> None:
        log("LOGIN", "clicking Login…")
        shot(self.page, "before_login_click")
        for sel in [
            "button.btn-danger:has-text('Login')",
            "button:has-text('Login')",
            "a:has-text('Login')",
            "button:has-text('Sign in')",
        ]:
            try:
                loc = self.page.locator(sel).first
                if loc.count() and loc.is_visible():
                    loc.click()
                    try:
                        self.page.wait_for_url(
                            lambda u: MS_LOGIN_HOST in u or MS_LIVE_HOST in u,
                            timeout=NAV_TIMEOUT_MS,
                        )
                    except Exception:
                        self.page.wait_for_load_state("domcontentloaded", timeout=NAV_TIMEOUT_MS)
                    time.sleep(2)
                    return
            except Exception:
                continue
        log("LOGIN", "login button clicked via no selector", ok=False)

    def _h_email(self) -> None:
        log("LOGIN", "filling email")
        shot(self.page, "ms_email_before")
        sel = "input[placeholder='someone@example.com'], input[name='loginfmt']"
        self.page.wait_for_selector(sel, state="visible", timeout=DEFAULT_TIMEOUT_MS)
        self.page.locator(sel).first.fill(self.email)
        time.sleep(0.5)
        self._ms_submit()
        # Let MS finish AJAX transition to password page.
        try:
            self.page.wait_for_selector(
                "input[placeholder='Password']",
                state="visible", timeout=15_000,
            )
        except Exception:
            pass
        time.sleep(3)
        shot(self.page, "ms_email_after")

    def _h_password(self) -> None:
        log("LOGIN", "filling password")
        shot(self.page, "ms_password_before")
        sel = "input[placeholder='Password'], input[type='password']:not([aria-hidden='true'])"
        self.page.wait_for_selector(sel, state="visible", timeout=DEFAULT_TIMEOUT_MS)
        loc = self.page.locator(sel).first
        loc.click()  # focus
        loc.fill("")  # clear
        loc.type(self.password, delay=30)
        time.sleep(0.8)
        self._ms_submit()
        try:
            self.page.wait_for_load_state("networkidle", timeout=15_000)
        except Exception:
            pass
        time.sleep(3)
        shot(self.page, "ms_password_after")

    def _h_totp(self) -> None:
        code = totp_code(self.totp_secret)
        log("LOGIN", "filling TOTP")
        shot(self.page, "ms_totp_before")
        sel = "input[name='otc'], input[id*='OTC'], input[id*='code'], input[name='otp']"
        self.page.wait_for_selector(sel, state="visible", timeout=DEFAULT_TIMEOUT_MS)
        loc = self.page.locator(sel).first
        loc.click()
        loc.fill("")
        loc.type(code, delay=60)
        time.sleep(0.5)
        self._ms_submit()
        time.sleep(4)
        shot(self.page, "ms_totp_after")

    def _h_stayloggedin(self) -> None:
        log("LOGIN", "stay-signed-in → Yes")
        shot(self.page, "ms_stay_before")
        # Let the card fully render/animate in before clicking.
        try:
            self.page.wait_for_selector(
                "input[value='Yes'], #idSIButton9, button:has-text('Yes')",
                state="visible", timeout=15_000,
            )
        except Exception:
            pass
        time.sleep(2)

        selectors = ["input[value='Yes']", "#idSIButton9", "button:has-text('Yes')"]
        for attempt in range(1, 4):
            clicked = False
            for sel in selectors:
                try:
                    loc = self.page.locator(sel).first
                    if loc.count() and loc.is_visible():
                        loc.scroll_into_view_if_needed(timeout=3000)
                        loc.click(timeout=5000)
                        clicked = True
                        log("LOGIN", f"stay-Yes clicked via {sel!r} (attempt {attempt})")
                        break
                except Exception as exc:
                    log("LOGIN", f"stay-Yes {sel!r} attempt {attempt} err: {exc}", ok=False)
                    continue
            if not clicked:
                log("LOGIN", f"stay-Yes no selector visible (attempt {attempt})", ok=False)
            # Wait & check whether MS page is gone
            try:
                self.page.wait_for_url(
                    lambda u: MS_LOGIN_HOST not in u and MS_LIVE_HOST not in u,
                    timeout=10_000,
                )
                log("LOGIN", "stay-Yes navigation confirmed")
                shot(self.page, "ms_stay_after")
                return
            except Exception:
                time.sleep(2)
                continue
        shot(self.page, "ms_stay_stuck")

    def _h_ms_transition(self) -> None:
        log("LOGIN", "MS transitional — waiting…")
        time.sleep(2)

    def _h_uowd_transition(self) -> None:
        log("LOGIN", "UOWD transitional — waiting…")
        time.sleep(2)

    def _h_unknown(self) -> None:
        self._unknown_count += 1
        shot(self.page, f"unknown_{self._unknown_count}")
        if self._unknown_count > 5:
            # URL elided — it carries OAuth codes / SAML tokens that get
            # flagged as sensitive when persisted in logs.
            raise RuntimeError("Stuck on unknown page (see debug screenshot).")
        log("LOGIN", f"unknown page (retry {self._unknown_count}/5)")
        time.sleep(3)

    def _ms_submit(self) -> None:
        for sel in [
            "input[type='submit']",
            "button[type='submit']",
            "#idSIButton9",
            "input[value='Next']",
            "input[value='Sign in']",
            "button:has-text('Next')",
            "button:has-text('Sign in')",
            "button:has-text('Verify')",
        ]:
            try:
                loc = self.page.locator(sel).first
                if loc.count() and loc.is_visible():
                    loc.click()
                    time.sleep(3)
                    return
            except Exception:
                continue
        log("LOGIN", "no submit btn — pressing Enter")
        try:
            self.page.keyboard.press("Enter")
        except Exception:
            pass
        time.sleep(3)


# ── Browser backends ─────────────────────────────────────────────────────────

BACKENDS = ["camoufox", "patchright"]


@contextmanager
def _camoufox_context(headless: bool, storage_state: Optional[str]) -> Iterator[Tuple[Any, Any]]:
    from camoufox.sync_api import Camoufox
    log("BROWSER", f"Camoufox  headless={headless}  state={'restore' if storage_state else 'fresh'}")
    with Camoufox(
        headless=headless,
        humanize=True,
        geoip=True,
        i_know_what_im_doing=True,
        locale=["en-US", "en"],
    ) as browser:
        kwargs: Dict[str, Any] = {}
        if storage_state and Path(storage_state).exists():
            kwargs["storage_state"] = storage_state
        ctx = browser.new_context(**kwargs)
        ctx.set_default_timeout(DEFAULT_TIMEOUT_MS)
        ctx.set_default_navigation_timeout(NAV_TIMEOUT_MS)
        yield browser, ctx


@contextmanager
def _patchright_context(headless: bool, storage_state: Optional[str]) -> Iterator[Tuple[Any, Any]]:
    from patchright.sync_api import sync_playwright
    log("BROWSER", f"Patchright  headless={headless}  state={'restore' if storage_state else 'fresh'}")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=headless,
            channel="chrome",
            args=["--disable-blink-features=AutomationControlled"],
        )
        kwargs: Dict[str, Any] = {
            "viewport": {"width": 1366, "height": 768},
            "locale": "en-US",
        }
        if storage_state and Path(storage_state).exists():
            kwargs["storage_state"] = storage_state
        ctx = browser.new_context(**kwargs)
        ctx.set_default_timeout(DEFAULT_TIMEOUT_MS)
        ctx.set_default_navigation_timeout(NAV_TIMEOUT_MS)
        try:
            yield browser, ctx
        finally:
            browser.close()


def open_backend(name: str, headless: bool, storage_state: Optional[str]):
    if name == "camoufox":
        return _camoufox_context(headless, storage_state)
    if name == "patchright":
        return _patchright_context(headless, storage_state)
    raise ValueError(f"unknown backend {name!r}")


# ── Scrape workflow ──────────────────────────────────────────────────────────

class Scraper:
    def __init__(
        self,
        email: str,
        password: str,
        totp_secret: str,
        headless: bool,
        backends: List[str],
        force_login: bool,
    ):
        self.email = email
        self.password = password
        self.totp_secret = totp_secret
        self.headless = headless
        self.backends = backends
        self.force_login = force_login
        self.supabase = init_supabase()
        self.room_map = fetch_room_mapping(self.supabase)

    def run(self, output_path: Path) -> bool:
        t0 = time.time()
        last_err: Optional[str] = None
        for backend in self.backends:
            log("RUN", f"Backend: {backend}")
            try:
                with open_backend(backend, self.headless, str(STORAGE_STATE_PATH) if not self.force_login else None) as (_browser, ctx):
                    page = ctx.new_page()
                    if self._scrape_once(ctx, page, output_path):
                        try:
                            ctx.storage_state(path=str(STORAGE_STATE_PATH))
                            log("STATE", f"saved → {STORAGE_STATE_PATH}")
                        except Exception as exc:
                            log("STATE", f"save failed: {exc}", ok=False)
                        log("RUN", f"Done in {time.time() - t0:.1f}s via {backend}")
                        return True
            except Exception as exc:
                last_err = f"{backend}: {exc}"
                log("RUN", f"{backend} failed: {exc}", ok=False)
                traceback.print_exc()
                continue
        log("RUN", f"All backends failed. last={last_err}", ok=False)
        return False

    # ── single attempt ──

    def _scrape_once(self, ctx, page, output_path: Path) -> bool:
        # First try: use existing session to jump straight to viewer.
        if STORAGE_STATE_PATH.exists() and not self.force_login:
            log("SESSION", "restoring — trying direct viewer load")
            try:
                page.goto(VIEWER_URL, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
                time.sleep(CF_SETTLE_SEC)
                handle_cloudflare(page)
                if self._is_viewer_ready(page):
                    log("SESSION", "cached session works — skipped login.")
                else:
                    log("SESSION", "cached session dead — re-auth required.")
                    self._wipe_state()
                    ctx.clear_cookies()
                    # fall through to full login
                    if not self._do_login(page):
                        return False
                    if not self._goto_viewer(page):
                        return False
            except Exception as exc:
                log("SESSION", f"restore err: {exc} — full login", ok=False)
                self._wipe_state()
                if not self._do_login(page):
                    return False
                if not self._goto_viewer(page):
                    return False
        else:
            if not self._do_login(page):
                return False
            if not self._goto_viewer(page):
                return False

        # semester
        sem_id = self._find_semester_id(page)
        if not sem_id:
            log("SCRAPE", "no semester id", ok=False)
            return False

        target = f"{VIEWER_URL}?semester={sem_id}"
        log("SCRAPE", f"loading {target}")
        page.goto(target, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
        time.sleep(3)
        handle_cloudflare(page)

        data = self._extract_json(page)
        if not data:
            shot(page, "no_json")
            log("SCRAPE", "no timetable data", ok=False)
            return False

        rows = self._write_csv(data, output_path)
        log("SCRAPE", f"wrote {rows} rows → {output_path}")
        return rows > 0

    # ── helpers ──

    def _wipe_state(self) -> None:
        try:
            if STORAGE_STATE_PATH.exists():
                STORAGE_STATE_PATH.unlink()
                log("STATE", "wiped")
        except Exception:
            pass

    def _do_login(self, page) -> bool:
        flow = LoginFlow(page, self.email, self.password, self.totp_secret)
        return flow.run()

    def _goto_viewer(self, page) -> bool:
        log("NAV", f"→ {VIEWER_URL}")
        page.goto(VIEWER_URL, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
        time.sleep(3)
        handle_cloudflare(page)
        shot(page, "viewer_landed")
        if self._is_viewer_ready(page):
            return True
        # maybe the viewer says "restricted" + here link
        try:
            if page.get_by_text("Timetable Viewer is restricted").is_visible(timeout=2000):
                log("NAV", "restricted → click here")
                page.get_by_text("here").click()
                page.wait_for_load_state("domcontentloaded", timeout=NAV_TIMEOUT_MS)
                time.sleep(3)
                handle_cloudflare(page)
        except Exception:
            pass
        return self._is_viewer_ready(page)

    def _is_viewer_ready(self, page) -> bool:
        try:
            return page.locator("input[type='radio']").first.is_visible(timeout=8000)
        except Exception:
            return False

    def _find_semester_id(self, page) -> Optional[str]:
        target = current_semester().lower()
        log("SCRAPE", f"looking for semester '{current_semester()}'")
        id_to_label: Dict[str, str] = {}
        try:
            radios = page.locator("input[type='radio']").all()
            for radio in radios:
                val = radio.get_attribute("value") or ""
                if not val:
                    continue
                rid = radio.get_attribute("id") or ""
                text = ""
                if rid:
                    try:
                        text = normalize_whitespace(
                            page.locator(f"label[for='{rid}']").first.inner_text(timeout=1000)
                        )
                    except Exception:
                        pass
                if not text:
                    try:
                        text = normalize_whitespace(
                            radio.locator("xpath=following-sibling::label[1]").inner_text(timeout=1000)
                        )
                    except Exception:
                        pass
                if not text:
                    try:
                        text = normalize_whitespace(
                            radio.locator("xpath=../label").first.inner_text(timeout=1000)
                        )
                    except Exception:
                        pass
                id_to_label[val] = text.lower()
        except Exception as exc:
            log("SCRAPE", f"radio scan err: {exc}", ok=False)

        if not id_to_label:
            return None

        for val, lbl in id_to_label.items():
            if lbl == target:
                log("SCRAPE", f"exact match: {lbl!r} → id={val}")
                return val
        for val, lbl in id_to_label.items():
            if target in lbl:
                log("SCRAPE", f"partial: {lbl!r} → id={val}")
                return val
        # Deliberate failsafe: refuse to fall back to any other semester — we
        # must not overwrite the current semester's CSV with data for a later
        # (or earlier) one before it ends.
        log("SCRAPE",
            f"target {target!r} not in viewer radios {list(id_to_label.values())}. "
            "Refusing to fall back — would overwrite current semester data.",
            ok=False)
        return None

    def _extract_json(self, page) -> Optional[List[Dict[str, Any]]]:
        html = page.content()
        match = re.search(r"timetableData\s*=\s*(\[.*?\])\s*;", html, re.DOTALL | re.MULTILINE)
        if not match:
            log("SCRAPE", "timetableData pattern not found", ok=False)
            return None
        try:
            data = json.loads(match.group(1))
            log("SCRAPE", f"parsed {len(data)} entries")
            return data
        except json.JSONDecodeError as exc:
            log("SCRAPE", f"json err: {exc}", ok=False)
            return None

    def _write_csv(self, data: List[Dict[str, Any]], path: Path) -> int:
        """
        Build rows in memory first; only overwrite the CSV if the new run
        produced data. Prevents wiping out current-semester data when an
        incomplete run (e.g. 0 rows) would otherwise truncate the file.
        """
        required = {"subject_code", "location", "week_day", "start_time", "end_time"}
        rows: List[Dict[str, str]] = []
        for entry in data:
            if not all(entry.get(f) for f in required):
                continue
            locs = [
                normalize_whitespace(l)
                for l in entry.get("location", "").split(";")
                if l.strip()
            ] or ["Unknown"]
            teachers = [
                normalize_whitespace(t)
                for t in entry.get("lecturer", "").split(";")
                if t.strip()
            ] or ["Unknown"]
            for loc in locs:
                room = resolve_room(loc, self.room_map)
                for teacher in teachers:
                    rows.append({
                        "SubCode":   entry.get("subject_code", "").replace(" ", ""),
                        "Class":     normalize_whitespace(entry.get("type_with_section", "")),
                        "Day":       normalize_whitespace(entry.get("week_day", "")),
                        "StartTime": format_time_hhmm(entry.get("start_time")),
                        "EndTime":   format_time_hhmm(entry.get("end_time")),
                        "Room":      room,
                        "Teacher":   teacher,
                    })

        if not rows:
            log("CSV", "0 rows — refusing to overwrite existing CSV", ok=False)
            return 0

        path.parent.mkdir(parents=True, exist_ok=True)
        # Atomic replace via temp file in same dir.
        tmp = path.with_suffix(path.suffix + ".tmp")
        with tmp.open("w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(
                fh,
                fieldnames=["SubCode", "Class", "Day", "StartTime", "EndTime", "Room", "Teacher"],
            )
            writer.writeheader()
            writer.writerows(rows)
        tmp.replace(path)
        return len(rows)


# ── Entry point ──────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape UOWD timetable")
    parser.add_argument("--output", required=True, type=Path, help="Output CSV path")
    parser.add_argument(
        "--headed", action="store_true",
        help="Run browser headed (default: headless)",
    )
    parser.add_argument(
        "--backend", choices=BACKENDS + ["auto"], default="auto",
        help="Browser backend (default: auto — tries all)",
    )
    parser.add_argument(
        "--force-login", action="store_true",
        help="Ignore cached session and re-authenticate",
    )
    args = parser.parse_args()

    email  = os.getenv("UOWD_EMAIL")
    passwd = os.getenv("UOWD_PASSWORD")
    totp   = os.getenv("UOWD_TOTP_SECRET")
    missing = [k for k, v in (("UOWD_EMAIL", email), ("UOWD_PASSWORD", passwd), ("UOWD_TOTP_SECRET", totp)) if not v]
    if missing:
        log("CONFIG", f"missing env: {', '.join(missing)}", ok=False)
        sys.exit(1)

    backends = BACKENDS if args.backend == "auto" else [args.backend]
    log("CONFIG", f"headless={not args.headed}  backends={backends}  force_login={args.force_login}")

    scraper = Scraper(
        email=email, password=passwd, totp_secret=totp,
        headless=not args.headed, backends=backends, force_login=args.force_login,
    )
    ok = scraper.run(args.output.resolve())
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
