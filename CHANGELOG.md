# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
