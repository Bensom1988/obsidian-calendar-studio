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

### Features (v0.2)

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
| P2 | CalDAV sync (tsdav) with offline cache | ✅ done (2026-10-30) |
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

**P2 as shipped**

- CalDAV accounts in the settings: server URL, user name, password, Basic or
  Digest authentication. The plugin discovers the calendars of an account and
  you tick the ones you want.
- Recurring events are expanded — weekly, monthly and yearly rules, with
  exceptions that move a single occurrence.
- The visible month (plus the months you configure) is fetched, so the
  calendar stays fast on big accounts.
- An offline cache keeps the last known schedule in the vault's plugin folder:
  the calendar still shows today's meetings when the server cannot be reached.
- One command (**Sync external calendars**) and an optional timer refresh the
  schedule; a failing account never hides the events of the other ones.
- The passwords are kept in Obsidian's secret storage, so they never end up in
  the vault — handy when the vault is synced through iCloud or Dropbox.
- **Import from Full Calendar Remastered**: the accounts of that plugin —
  passwords included — move over in one click.

### CalDAV setup

1. Open *Settings → Calendar Studio → External calendars* and switch the
   source on.
2. Press **Add account** and fill in the server URL, user name and password.
   The server URL may be the root of the service
   (`https://p216-caldav.icloud.com.cn/`) or the account URL your provider
   shows you — the plugin looks for the calendars of the account by itself.
   Apple, for instance, needs an *app-specific password*.
3. Press **Test connection**. The calendars of the account show up; tick the
   ones you want. The plugin reads and writes the collections you ticked
   directly, so a server that does not answer the usual discovery still
   works.
4. Press **Sync now** (or wait for the automatic sync).

Coming from Full Calendar Remastered? Press **Import from Full Calendar
Remastered** instead — the accounts move over with their passwords.

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

Third-party: `lunar-javascript` (MIT), `tsdav` (MIT), `ical.js` (MPL-2.0).

---

## 简体中文

Calendar Studio 把你的知识库变成一台日历。它读取笔记里藏着的每一个日期——
frontmatter 字段、任务行、文件名——再通过 CalDAV 合并你的真实日程，然后让你
把日历上的任意一天变成一篇笔记、一个任务或一份报告。

### 特性（v0.2）

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
| P2 | CalDAV 同步与离线缓存 | ✅ 已完成（2026-10-30） |
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

**P2 已交付**

- 设置里可以添加多个 CalDAV 账号：服务器地址、用户名、密码，Basic 或 Digest 认证。
  插件会自动列出账号下的日历，勾选你要的那几个。
- 循环日程会展开成一次次的具体安排——每周、每月、每年的规则都支持，
  单次改期（例外）也会被正确处理。
- 只抓取当前显示的月份（外加你配置的月份数），账号再大也不卡。
- 离线缓存把上次同步到的日程留在插件目录里：服务器连不上时，日历照样
  显示今天的安排。
- 一个「同步外部日历」命令 + 可选的定时刷新；某个账号出错不会影响其他账号。
- 密码存在 Obsidian 的安全存储里，不会写进库文件——库用 iCloud 或 Dropbox 同步时，
  密码不会跟着明文到处跑。
- 「从 Full Calendar Remastered 导入」：那个插件里的账号（含密码）一键接过来。

**CalDAV 配置**

1. 打开 *设置 → 日历工作台 → 外部日历*，把这一项打开。
2. 点「添加账号」，填服务器地址、用户名、密码。地址可以填服务根地址
   （如 `https://p216-caldav.icloud.com.cn/`），也可以填服务商给你的账号地址，
   插件会自己做服务发现。Apple 需要在账户里生成**专用密码**。
3. 点「测试连接」，账号下的日历会列出来，勾选需要的。
4. 点「立即同步」，或者等自动同步。

从 Full Calendar Remastered 过来的话，直接点「从 Full Calendar Remastered 导入」，
账号连密码一起接过来。

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

第三方依赖：`lunar-javascript`（MIT）、`tsdav`（MIT）、`ical.js`（MPL-2.0）。
