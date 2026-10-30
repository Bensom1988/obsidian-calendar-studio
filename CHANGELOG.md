# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-10-30

### Added

- **P3 — Embedded code block & ICS export**:
  - Live `calendar-studio` fenced code block supporting `type: agenda | day | week | month`, `date`, `days`, `limit`, `calendar`, and `source` filters.
  - "导出 ICS 日历 / Export ICS calendar" command (RFC 5545 compliant, line folding, text escaping, configurable export folder).
- **P4 — Periodic reports & optional AI narrative summary**:
  - Commands and toolbar buttons for Weekly (`YYYY-[W]WW`), Monthly (`YYYY-MM`) and Annual (`YYYY`) reports.
  - Structured Markdown overview grouping schedules, completed tasks, open tasks and dated notes inside `<!-- calendar-studio:report:start -->` … `<!-- calendar-studio:report:end -->` markers so personal notes outside the block are preserved.
  - Optional OpenAI-compatible AI summary (defaults to DeepSeek API `deepseek-chat`), reading the API key from Obsidian's secret storage or a configurable environment variable (`DEEPSEEK_API_KEY`).
- **P5 — Lunar calendar, solar terms, statutory holidays & UI polish**:
  - Statutory Chinese holidays (`休`) and makeup workdays (`班`) badges on the month grid, plus lunar month names on the first day of each lunar month (`初一`).
  - Selected date's full lunar date and solar term shown in the main view toolbar.
  - Main month view now renders the selected day's agenda directly beneath the month grid.

### Fixed

- Week-number column in the main month grid now renders once per week row instead of before every day cell.
- "Today" highlight in the main month grid now checks the full year as well as month and day.
- Escaped literal brackets (such as `YYYY-[W]WW`) are now supported in date patterns.

## [0.3.0] - 2026-10-30

### Added

- CalDAV source: several accounts with server URL, user name, password and
  Basic or Digest authentication. The plugin discovers the calendars of an
  account and you tick the ones you want.
- Recurring events are expanded into their single occurrences — weekly,
  monthly and yearly rules — and an exception that moves one occurrence is
  honoured.
- An offline cache (`caldav-cache.json` in the plugin folder) keeps the last
  known schedule, so the calendar still shows today's events when the server
  cannot be reached.
- The command "同步外部日历 / Sync external calendars" plus an optional timer
  (15 minutes up to 3 hours, switchable off) refresh the external calendars.
- Settings for the automatic sync, the sync range around the visible month and
  the authentication method.
- The passwords of the accounts live in Obsidian's secret storage, so they
  never enter the vault — a vault that is synced through iCloud or Dropbox no
  longer carries them around in plain text.
- "Import from Full Calendar Remastered" takes over the accounts of that
  plugin, including the passwords it keeps in the secret storage.

### Changed

- The plugin only fetches the visible month (plus the months you configure),
  which keeps big accounts fast.

### Fixed

- The CalDAV requests go through Obsidian's own request function now. The
  browser inside Obsidian refused the requests of a CalDAV server with
  "Failed to fetch", because such a server does not answer with the headers
  a browser asks for.
- The plugin reads and writes the calendar collections directly instead of
  first asking the server where they live. That discovery step is not
  implemented the same way by every server — DingTalk, for example, does not
  answer it — and the collections of an account are known anyway.
- Importing the accounts of "Full Calendar Remastered" twice does not create
  the accounts twice.
- A broken iCalendar document no longer breaks the whole calendar; it is
  skipped.
- Writing the settings no longer empties the settings file when two writes
  happen at the same time.
- Two settings writes at the same time no longer truncate each other: the
  writes are queued, so the settings file cannot end up empty.

## [0.2.0] - 2026-10-30

### Added

- A task source that reads the Tasks plugin notation — `📅` due, `⏳` scheduled,
  `🛫` start, `➕` created, `✅` done — and inline fields such as
  `[due:: 2026-10-30]`. The plugin's global filter is honoured.
- "写日记 / Create daily note" writes the selected day's note: the agenda lands
  between `<!-- calendar-studio:agenda:start -->` and
  `<!-- calendar-studio:agenda:end -->`, your own text is never overwritten and
  running it twice does not duplicate the block.
- "生成任务 / Generate tasks" turns the selected day's schedule into Markdown
  tasks, written into the daily note or into a note of your choice.
- Templates for both the daily note and the task list, with a configurable date
  format (`YYYY-MM-DD`, `YYYY年MM月DD日`, …).
- New settings section **Workflow** (daily-note folder and format, template
  paths, task target) in both English and Simplified Chinese.

### Changed

- The event index rebuilds asynchronously and ignores results from a stale
  rebuild, so a slow source can no longer overwrite fresh data.
- Task lines are parsed with pre-compiled patterns and cached per file: a vault
  with thousands of notes is scanned in about a second instead of freezing
  Obsidian.

### Fixed

- Saving settings no longer triggers two index rebuilds at once.

## [0.1.0] - 2026-10-30

### Added

- Core event model, date utilities and an incrementally rebuilt event index.
- Data sources: frontmatter date properties and filename date patterns — both
  fully configurable, no hard-coded paths.
- Apple-inspired design system with light/dark support.
- Sidebar mini month and main-area month grid with an agenda list.
- English and Simplified Chinese interfaces with runtime switching.
- Optional lunar date, solar term and public holiday display.
