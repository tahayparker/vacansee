# vacansee

Real-time room availability for the University of Wollongong in Dubai.
Scrapes the official timetable viewer, normalises it into a queryable
schedule, and exposes search / browse / visualisation over the result.

Live: [vacansee](https://vacansee.vercel.app)

## What it does

- **Now / Soon** - shows rooms currently free and rooms that free up in
the next hour, filtered to the current day + session block.
- **Check** - ad-hoc availability query: pick a room + time window, get
back whether it is free and what sits on either side.
- **Rooms** - directory of every timetabled space with capacity + code.
- **Graph** / **Custom graph** - weekly occupancy heatmap per room,
filterable by weekday, room subset, and session blocks.
- **Profile** - Microsoft Entra SSO via Supabase; maintains
`time_format` preference (12h / 24h) and dismissed-onboarding flags.

## Architecture

```
+-----------------------------------+      +-----------------------------+
| GitHub Actions                    |      | my.uowdubai.ac.ae           |
|  - update-timetable.yml           | ---> |   /timetable/viewer         |
|    - check_schedule.py (gate)     |      |   (Cloudflare-protected)    |
|    - update_schedule.py (cal)     |      +-----------------------------+
|    - scrape_timetable_auth.py     |
|    - upload_timetable.py          |      +-----------------------------+
|    - generate_schedule.py         | ---> | Supabase Postgres           |
+-----------------------------------+      |   Rooms / Teacher / Timings |
            |                              +-----------------------------+
            | writes public/classes.csv
            | writes public/scheduleData.json
            v
+-----------------------------------+      +-----------------------------+
| Next.js Pages Router              | <--- | Supabase Auth (Entra SSO)   |
|  - /api/* (Prisma -> Postgres)    |      +-----------------------------+
|  - /api/schedule (static JSON)    |
|  - Vercel serverless + edge MW    |
+-----------------------------------+
```

## Tech stack


| Layer      | Choice                                                                   |
| ---------- | ------------------------------------------------------------------------ |
| Frontend   | Next.js 15 (Pages Router), React 19, TypeScript, Tailwind, Framer Motion |
| Auth       | Supabase (`@supabase/ssr`) on Microsoft Entra SSO                        |
| DB ORM     | Prisma 7 (+ `@prisma/adapter-pg`) -> Supabase Postgres                   |
| Middleware | Edge middleware for session refresh + maintenance mode                   |
| Scraper    | Python + Camoufox (Firefox fingerprint spoof) + Patchright fallback      |
| CI         | GitHub Actions (cron + workflow_dispatch)                                |
| Hosting    | Vercel                                                                   |


## Repository layout

```
├─ prisma/
│  └─ schema.prisma            Rooms / Teacher / Timings
├─ public/
│  ├─ classes.csv              Scraper output, committed by CI
│  ├─ scheduleData.json        Pre-aggregated weekly heatmap data
│  └─ academic_schedule.json   Peak-window cache (semester dates)
├─ scripts/                    Python scrapers + CI helpers
│  ├─ scrape_timetable_auth.py Auth'd scraper (Camoufox + Patchright)
│  ├─ update_schedule.py       Academic calendar parser
│  ├─ check_schedule.py        Peak / off-peak gate (exits 78 to skip)
│  ├─ upload_timetable.py      CSV -> Postgres via Prisma schema
│  ├─ update_rooms.py          Sync Rooms table with timetable
│  ├─ generate_schedule.py     Rebuild scheduleData.json
│  ├─ db_connection.py         Shared Supabase client
│  ├─ restore_db.sh            Interactive restore from a backup dump
│  └─ requirements.txt
├─ src/
│  ├─ pages/                   Next.js Pages Router
│  │  ├─ api/                  Serverless handlers (Prisma queries)
│  │  └─ auth/                 Login + OAuth callback
│  ├─ components/              UI + layout + widgets
│  ├─ hooks/                   useRequireAuth, useUserPreferences
│  ├─ lib/                     supabase clients, prisma, utils
│  └─ middleware.ts            Session + maintenance mode
└─ .github/workflows/
   ├─ update-timetable.yml     Scrape + upload + regen (peak vs daily)
   ├─ ping-supabase.yml        Keep-alive ping for free-tier DB
   └─ backup-database.yml      Daily pg_dump -> vacansee-db-backups
```

## Getting started

Requires Node 20+, Python 3.12+, and a Supabase project.

```bash
git clone https://github.com/tahayparker/vacansee.git
cd vacansee
npm install
```

Copy `.env.example` to `.env.local` and fill the Supabase credentials
(and the UOWD scraper creds if you plan to run the scraper locally):

```
DATABASE_URL=            # Supabase pooled connection string
DIRECT_URL=              # Supabase direct (used by Prisma migrations)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Scraper only - not read by the web app
UOWD_EMAIL=
UOWD_PASSWORD=
UOWD_TOTP_SECRET=        # base32 shared secret (not an OTP)
```

Seed the schema + run dev:

```bash
npx prisma generate
npm run dev
```

Opens at `http://localhost:3000`.

## Running the scraper locally

```bash
python -m venv .venv
source .venv/bin/activate         # on Windows: .venv\Scripts\activate
pip install -r scripts/requirements.txt
python -m camoufox fetch
python -m patchright install chromium --with-deps

python scripts/scrape_timetable_auth.py --output public/classes.csv
```

Flags:

- `--headed` - run browser visibly (default is headless for CI).
- `--backend camoufox|patchright|auto` - force a specific stealth
backend. Default `auto` tries both in order.
- `--force-login` - ignore the cached `.storage_state.json` and
re-authenticate through MS OAuth from scratch.

The scraper persists a `.storage_state.json` after a successful login;
subsequent runs reuse that session so they skip the MS OAuth round-trip
until the cookies expire.

## Automated data refresh

`[.github/workflows/update-timetable.yml](.github/workflows/update-timetable.yml)`
drives the CI pipeline. Two schedules:


| Trigger     | Cron                    | Behaviour                                                                                              |
| ----------- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| Peak 15-min | `*/15 * * * *`          | Runs only if today is inside an active peak window (see below). Gated via `scripts/check_schedule.py`. |
| Daily       | `0 4 * * *` (08:00 GST) | Always runs, also refreshes `public/academic_schedule.json`.                                           |
| Manual      | `workflow_dispatch`     | Always runs.                                                                                           |


Peak window per semester:

```
peak_start = max(
  tutorial_enrolment_start - 14 days,
  previous_semester.final_exam_start,
)
peak_end   = last_date_to_enrol_in_subjects
```

The clamp to `previous.final_exam_start` exists so a new semester's
enrolment peak never overlaps an active teaching semester, which would
cause the scraper to overwrite the current semester's CSV before
teaching ends. The active semester itself is defined as the one whose
first final-exam date is next in the future.

The session cache (`.storage_state.json`) and the academic calendar
cache (`public/academic_schedule.json`) persist across runs via
`actions/cache` and the Git commit graph respectively. Scraper debug
screenshots (`scripts/debug/`) are uploaded as an artifact on failure.

## Safety rails in the scraper

- Refuses to overwrite `public/classes.csv` with zero rows (an empty
viewer response, a failed auth, or a DOM drift no longer wipes the
current dataset).
- Refuses to fall back to a different semester's radio when the
expected one is missing - avoids overwriting current data with
upcoming data during the transition gap.
- CSV write is atomic via tmp-file + rename.
- URL values never logged - post-OAuth URLs carry one-shot auth codes.

## Database schema

```prisma
model Rooms {
  id        Int    @id @default(autoincrement())
  Name      String
  ShortCode String
  Capacity  Int?

  @@index([ShortCode])
  @@index([Name])
}

model Timings {
  id        Int    @id @default(autoincrement())
  SubCode   String
  Class     String
  Day       String
  StartTime String
  EndTime   String
  Room      String
  Teacher   String

  @@index([Day, StartTime, EndTime])
  @@index([Room])
  @@index([Day])
}

model Teacher {
  id    Int    @id @default(autoincrement())
  Name  String
  Email String
  Phone String
}
```

`Rooms.Name` (canonical) and `Rooms.ShortCode` (from the viewer) are
resolved against each other at scrape time.

## API routes


| Method | Route                     | Purpose                                        |
| ------ | ------------------------- | ---------------------------------------------- |
| `GET`  | `/api/rooms`              | List rooms with capacity + short code          |
| `GET`  | `/api/available-now`      | Rooms free at the current minute               |
| `GET`  | `/api/available-soon`     | Rooms freeing up within the next hour          |
| `GET`  | `/api/check-availability` | Point-in-time availability for a room + window |
| `GET`  | `/api/schedule`           | Static pre-aggregated weekly heatmap           |
| `GET`  | `/api/auth/callback`      | Supabase OAuth callback handler                |


All `/api/*` except `/api/auth/callback` require an authenticated
session (enforced by `src/middleware.ts`).

## Database backups

[`.github/workflows/backup-database.yml`](.github/workflows/backup-database.yml)
runs daily at 02:00 UTC and snapshots the `public` schema via
`pg_dump` into
[tahayparker/vacansee-db-backups](https://github.com/tahayparker/vacansee-db-backups)
as `backups/YYYY-MM-DD.sql.gz` (+ a `latest.sql.gz` pointer). Retention
is 90 days — older files are pruned before each commit.

Restore a dump with [`scripts/restore_db.sh`](scripts/restore_db.sh):

```bash
export DIRECT_URL="postgresql://postgres.XXXX:[PASSWORD]@aws-0-....pooler.supabase.com:5432/postgres"
bash scripts/restore_db.sh /path/to/backup.sql.gz
```

The script prints the dump header + object summary, prompts for
explicit `restore` confirmation, and applies the dump in a single
transaction with `ON_ERROR_STOP=on` so partial failures roll back.

Secrets required on the `vacansee` repo:

- `DIRECT_URL` — unpooled Supabase connection string (already used by
  Prisma migrations). The workflow uses this directly with `pg_dump`.
- `BACKUP_REPO_TOKEN` — fine-grained PAT scoped to
  `tahayparker/vacansee-db-backups` with `Contents: Read and write`.

## Deployment

Push to `main` on GitHub -> Vercel rebuilds automatically. CI-authored
commits tagged `[skip deploy]` (`scripts/ignore-build-step.js`) skip
the rebuild since they only change data files already baked into the
running build at request time.

## Contributing

Fork, branch, submit a PR. Keep PRs focused - one concern per branch.
Run `npm run lint` and `npm run build` before submitting. Conventional
Commits preferred for subject lines.