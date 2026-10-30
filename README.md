# Calendar Studio

**An Apple-inspired, bilingual calendar for Obsidian — one surface for everything that has a date.**

[English](#english) · [简体中文](#简体中文)

---

## English

Calendar Studio turns your vault into a calendar. It reads every date hiding in
your notes — frontmatter fields, task lines, filenames — merges them with your
real-world calendars over CalDAV, and lets you turn any date on the grid into a
note, a task, or a report.

### Why

Obsidian vaults accumulate dates in every shape: a `due` property, a `📅 2026-10-30`
emoji on a task, a daily note called `2026-10-30.md`, a weekly review. No single
plugin surfaces them all. Calendar Studio does, in one clean grid, and then
*acts* on what you click.

### Features (v0.1 — in progress)

- **One calendar, many sources** — frontmatter properties, task lines, filename
  dates and external CalDAV calendars are normalised into a single event model.
- **Apple-inspired UI** — hairline separators, 8pt spacing grid, a single accent
  colour, system typography. Light and dark themes follow Obsidian.
- **Bilingual** — full English and Simplified Chinese interfaces, switchable at
  runtime.
- **Optional Chinese calendar** — lunar dates, solar terms and public holidays
  can be shown next to every day; off by default for non-Chinese users.
- **Calendar-driven workflow** — click a date to create that day's note, turn a
  schedule into a task, or start a period report.
- **AI-assisted reports** — optional: summarise a day, week, month or year into
  a draft report via any OpenAI-compatible endpoint. The plugin works fully
  without it.

### Status

| Phase | Scope | State |
|---|---|---|
| P0 | Engine, bilingual UI, vault sources, month views | ✅ done (2026-10-30) |
| P1 | Task source, daily-note and task creation | ✅ done (2026-10-30) |
| P2 | CalDAV sync (tsdav) with offline cache | planned |
| P3 | Embedded code block, ICS export | planned |
| P4 | AI report generation | planned |
| P5 | Polish, lunar/holiday data, tests, docs | planned |

**P0 as shipped**

- One normalised `CalendarEvent` model; the index, the views and the exporters
  only ever see that shape.
- Two pluggable sources, both fully configurable: frontmatter date properties
  and date patterns in file names.
- Sidebar mini month and a main month grid with an agenda panel.
- English / Simplified Chinese, switchable at runtime; optional lunar dates,
  solar terms and festivals.
- Incrementally rebuilt index — the vault is never re-scanned from scratch on
  every keystroke.

**P1 as shipped**

- A task source that understands the Tasks plugin notation (`📅` due, `⏳`
  scheduled, `🛫` start) and inline fields (`[due:: 2026-10-30]`), with the
  plugin's global filter honoured.
- One click on any date writes that day's note: the agenda goes between
  markers, your own text is never touched, and running it twice does not
  duplicate anything.
- The same click turns the day's schedule into Markdown tasks, either in the
  daily note or in a note you choose.
- Templates for both, with a date format you pick (`YYYY-MM-DD`,
  `YYYY年MM月DD日`, …).

### Install

**Option A — BRAT (recommended)**

1. Install the [BRAT](https://github.com/Tepb0/obsidian-brat) community plugin.
2. In BRAT's settings choose **Add new plugin** and enter:
   `https://github.com/Bensom1988/obsidian-calendar-studio`
3. Press **Install** — BRAT downloads the latest release automatically.

**Option B — manual**

Download `main.js`, `manifest.json` and `styles.css` from the
[latest release](https://github.com/Bensom1988/obsidian-calendar-studio/releases/latest),
copy them into `<your vault>/.obsidian/plugins/calendar-studio/`, then enable
**Calendar Studio** in *Settings → Community plugins*.

**Option C — build from source**

```bash
git clone https://github.com/Bensom1988/obsidian-calendar-studio
cd obsidian-calendar-studio
npm install
npm run build
VAULT_PATH="/path/to/your/vault" npm run deploy
```

### Development

```bash
npm install
npm run dev        # watch build
npm run build      # type-check + production build
npm run test       # unit tests
npm run deploy     # copy the build into $VAULT_PATH/.obsidian/plugins/calendar-studio
```

### Architecture

```
src/
  core/       event model, date utilities, incremental index
  sources/    frontmatter · task lines · filenames · CalDAV
  ui/         sidebar mini month · month grid · agenda
  i18n/       en / zh-CN dictionaries
  lang/       Obsidian-convention locale files
```

Everything personal is a *setting*, never a hard-coded path. The plugin has no
telemetry and makes no network requests unless you configure a CalDAV account
or an AI endpoint yourself.

### License

MIT — see [LICENSE](LICENSE).

Third-party: `lunar-javascript` (MIT), `tsdav` (MIT), `rrule` (BSD-3-Clause),
`ical.js` (MPL-2.0).

---

## 简体中文

Calendar Studio 把你的知识库变成一台日历。它读取笔记里藏着的每一个日期——
frontmatter 字段、任务行、文件名——再通过 CalDAV 合并你的真实日程，然后让你
把日历上的任意一天变成一篇笔记、一个任务或一份报告。

### 特性（v0.1 — 开发中）

- **一个日历，多种来源** — frontmatter 属性、任务行、文件名日期、外部 CalDAV 日历，
  全部归一为同一个事件模型。
- **苹果风格界面** — 发丝级分隔线、8pt 间距、单一强调色、系统字体，
  亮色与暗色跟随 Obsidian 主题。
- **中英双语** — 完整的中文与英文界面，运行时可切换。
- **农历可选** — 农历、节气、法定节假日可显示在每一天旁边，默认关闭。
- **日历驱动工作流** — 点击日期即可生成当日笔记、把日程转成任务、开始一份周期报告。
- **AI 辅助报告** — 可选功能：把一天/一周/一月/一年汇总成报告草稿。
  不配置也能完整使用。

### 状态

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | 引擎、双语界面、库内数据源、月历视图 | ✅ 已完成（2026-10-30） |
| P1 | 任务源、日记与任务生成 | ✅ 已完成（2026-10-30） |
| P2 | CalDAV 同步与离线缓存 | 计划中 |
| P3 | 可嵌入代码块、ICS 导出 | 计划中 |
| P4 | AI 报告生成 | 计划中 |
| P5 | 打磨、农历节假日数据、测试、文档 | 计划中 |

**P1 已交付**

- 任务源：认识 Tasks 插件的记法（`📅` 截止、`⏳` 计划、`🛫` 开始）与内联字段
  （`[due:: 2026-10-30]`），并遵循插件的全局过滤标签。
- 点日历任意一天即可写入当天日记：日程写进标记块之间，你自己写的内容
  一个字都不会动，重复点击也不会写出两份。
- 同一次点击还能把当天日程变成 Markdown 任务，可以写进当天日记，也可以
  写到你指定的文件。
- 日记与任务都支持模板，日期格式随你选（`YYYY-MM-DD`、`YYYY年MM月DD日` 等）。

### 安装

**方式 A — BRAT（推荐）**

1. 安装 [BRAT](https://github.com/Tepb0/obsidian-brat) 社区插件。
2. 打开 BRAT 设置，点 **Add new plugin**，填入：
   `https://github.com/Bensom1988/obsidian-calendar-studio`
3. 点 **Install** — BRAT 会自动下载最新版本。

**方式 B — 手动**

从[最新版本](https://github.com/Bensom1988/obsidian-calendar-studio/releases/latest)下载
`main.js`、`manifest.json`、`styles.css`，放进
`<你的库>/.obsidian/plugins/calendar-studio/`，然后在 *设置 → 第三方插件*
里启用 **Calendar Studio**。

**方式 C — 从源码构建**

```bash
git clone https://github.com/Bensom1988/obsidian-calendar-studio
cd obsidian-calendar-studio
npm install
npm run build
VAULT_PATH="/你的库路径" npm run deploy
```

### 开发

```bash
npm install
npm run dev     # 监听构建
npm run build   # 类型检查 + 生产构建
npm run test    # 单元测试
npm run deploy  # 部署到 $VAULT_PATH/.obsidian/plugins/calendar-studio
```

### 设计原则

**没有任何个人路径被写死。** 日记目录、日期字段、文件名格式、周报位置全部是设置项。
插件不含遥测，除你自己配置的 CalDAV 账号与 AI 端点外不发起任何网络请求。

### 许可

MIT — 见 [LICENSE](LICENSE)。

第三方依赖：`lunar-javascript`（MIT）、`tsdav`（MIT）、`rrule`（BSD-3-Clause）、
`ical.js`（MPL-2.0）。
