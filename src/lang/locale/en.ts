export default {
	'plugin.name': 'Calendar Studio',

	'ribbon.calendar': 'Open calendar',
	'ribbon.miniCalendar': 'Open mini calendar',

	'command.openCalendar': 'Open calendar view',
	'command.openMiniCalendar': 'Open mini calendar in sidebar',
	'command.goToToday': 'Go to today',
	'command.createDailyNote': 'Create the daily note of the selected day',
	'command.generateTasks': 'Turn the selected day into tasks',
	'command.syncCalDav': 'Sync external calendars',

	'command.exportIcs': 'Export ICS calendar',

	'export.icsName': 'Obsidian calendar',

	'notice.icsExported': 'Exported {{count}} events to {{path}}',
	'notice.icsEmpty': 'There are no events to export this month.',
	'notice.icsFailed': 'The export failed, see the console for details.',

	'embed.agenda': 'Calendar',
	'view.month': 'Month',
	'view.agenda': 'Agenda',
	'view.today': 'Today',
	'view.previousMonth': 'Previous month',
	'view.nextMonth': 'Next month',
	'view.noEvents': 'Nothing planned for this day.',
	'view.noSelection': 'Pick a day to see its events.',
	'view.eventsCount': '{{count}} events',
	'view.eventCount': '{{count}} event',
	'view.allDay': 'All day',
	'view.lunar': 'Lunar',
	'view.settings': 'Settings',
	'view.actions': 'Actions',
	'view.untitled': 'Untitled',
	'action.createDailyNote': 'Daily note',
	'action.createDailyNoteDesc': 'Create the note of this day from a template.',
	'action.generateTasks': 'Make tasks',
	'action.generateTasksDesc': 'Write this day’s events into a note as tasks.',

	'notice.dailyNote': 'Daily note',
	'notice.tasks': 'Tasks written',
	'notice.failed': 'Something went wrong — see the console for details.',
	'notice.caldavSynced': 'Synced {{count}} events',
	'notice.caldavDisabled': 'External calendars are switched off.',
	'notice.caldavTesting': 'Testing the connection…',
	'notice.caldavTestOk': 'Found {{count}} calendars',
	'notice.caldavTestFailed': 'Could not reach the server: {{message}}',
	'notice.caldavImportOk': 'Imported {{count}} accounts ({{passwords}} with a password)',
	'notice.caldavImportNone': 'No Full Calendar Remastered accounts were found.',

	'source.frontmatter': 'Note properties',
	'source.filenames': 'File names',
	'source.tasks': 'Task lines',
	'source.caldav': 'External calendars',
	'source.frontmatterDesc':
		'Dates stored in frontmatter, such as a `due` or `start` property.',
	'source.filenamesDesc': 'Dates written into file names, such as `2026-10-30.md`.',
	'source.tasksDesc': 'Dates attached to task lines with 📅 ⏳ 🛫.',
	'source.caldavDesc': 'External calendars synced over CalDAV.',

	'settings.language': 'Interface language',
	'settings.languageDesc': 'Language used by the plugin interface.',
	'settings.languageEn': 'English',
	'settings.languageZh': '简体中文',
	'settings.locale': 'Date locale',
	'settings.localeDesc':
		'BCP-47 tag used to format dates, for example `en-US`, `zh-CN`, `de-DE`.',
	'settings.weekStart': 'First day of the week',
	'settings.weekStartDesc': 'Where the week and the month grid start.',
	'settings.weekStartSunday': 'Sunday',
	'settings.weekStartMonday': 'Monday',
	'settings.showLunar': 'Show lunar dates',
	'settings.showLunarDesc':
		'Display the Chinese lunar date, solar terms and festivals next to each day.',
	'settings.showWeekNumbers': 'Show week numbers',
	'settings.showWeekNumbersDesc': 'Add an ISO week number column to the month grid.',

	'settings.sources': 'Data sources',
	'settings.sourcesDesc': 'Choose where the calendar collects dates from.',
	'settings.sourceEnabled': 'Enabled',
	'settings.includeFolders': 'Included folders',
	'settings.includeFoldersDesc':
		'Comma-separated folder paths. Leave empty to include the whole vault.',
	'settings.excludeFolders': 'Excluded folders',
	'settings.excludeFoldersDesc': 'Comma-separated folder paths to skip.',

	'settings.frontmatterRules': 'Property rules',
	'settings.frontmatterRulesDesc':
		'Which frontmatter properties count as dates, and what they mean.',
	'settings.property': 'Property',
	'settings.propertyPlaceholder': 'due',
	'settings.kind': 'Meaning',
	'settings.kindStart': 'Start',
	'settings.kindDue': 'Due',
	'settings.kindEnd': 'End',
	'settings.kindAllDay': 'Single day',
	'settings.addRule': 'Add property',
	'settings.removeRule': 'Remove',

	'settings.filenameFormats': 'Name formats',
	'settings.filenameFormatsDesc':
		'Comma-separated date patterns, for example `YYYY-MM-DD`.',
	'settings.globalFilter': 'Task filter',
	'settings.globalFilterDesc':
		'Only task lines containing this text are picked up. Leave empty for all.',

	'settings.accounts': 'CalDAV accounts',
	'settings.addAccount': 'Add account',
	'settings.removeAccount': 'Remove',
	'settings.accountName': 'Name',
	'settings.serverUrl': 'Server URL',
	'settings.username': 'Username',
	'settings.password': 'Password',
	'settings.color': 'Colour',
	'settings.caldavAutoSync': 'Automatic sync',
	'settings.caldavAutoSyncDesc':
		'How often the plugin refreshes external calendars. “Off” disables the timer.',
	'settings.caldavAutoSyncOff': 'Off',
	'settings.caldavAutoSync15': 'Every 15 minutes',
	'settings.caldavAutoSync30': 'Every 30 minutes',
	'settings.caldavAutoSync60': 'Every hour',
	'settings.caldavAutoSync180': 'Every 3 hours',
	'settings.caldavRange': 'Sync range',
	'settings.caldavRangeDesc':
		'How much around the visible month is fetched from the server.',
	'settings.caldavRangeCurrent': 'The visible month',
	'settings.caldavRangeOne': 'One month before and after',
	'settings.caldavRangeThree': 'Three months before and after',
	'settings.caldavAuthMethod': 'Authentication',
	'settings.caldavAuthBasic': 'Basic',
	'settings.caldavAuthDigest': 'Digest',
	'settings.caldavCalendars': 'Calendars',
	'settings.caldavCalendarsDesc': 'Pick the calendars whose events should be shown.',
	'settings.caldavNoCalendars': 'No calendars yet — test the connection first.',
	'settings.caldavTest': 'Test connection',
	'settings.caldavSyncNow': 'Sync now',
	'settings.caldavLastSync': 'Last sync: {{time}}',
	'settings.caldavNeverSynced': 'Not synced yet',
	'settings.caldavError': 'Error: {{message}}',
	'settings.caldavPasswordWarning':
		'The password is stored in this vault’s plugin settings file. Do not commit it.',
	'settings.caldavPasswordStored':
		'Stored in Obsidian’s secret storage — the password never enters the vault.',
	'settings.caldavPasswordPlain':
		'This Obsidian version cannot keep secrets, so the password stays in the settings file.',
	'settings.caldavImport': 'Import from Full Calendar Remastered',
	'settings.caldavImportDesc':
		'Take over the accounts of Full Calendar Remastered — including the passwords it keeps in Obsidian’s secret storage.',

	'settings.workflow': 'Daily notes and tasks',
	'settings.workflowDesc':
		'How the plugin turns a day on the calendar into a note or a list of tasks.',
	'settings.useCoreDailyNotes': 'Follow Obsidian’s daily notes',
	'settings.useCoreDailyNotesDesc':
		'Use the folder, format and template of the core Daily notes plugin when it is enabled.',
	'settings.dailyNoteFolder': 'Daily note folder',
	'settings.dailyNoteFolderDesc': 'Folder for new daily notes. Empty means the vault root.',
	'settings.dailyNoteFormat': 'Daily note format',
	'settings.dailyNoteFormatDesc': 'File name pattern, for example `YYYY-MM-DD`.',
	'settings.templatePath': 'Daily note template',
	'settings.templatePathDesc':
		'Path of a template file. Placeholders: {{title}}, {{date}}, {{weekday}}, {{events}}.',
	'settings.taskTemplatePath': 'Task template',
	'settings.taskTemplatePathDesc':
		'Path of a file with one task template per line. Placeholders: {{title}}, {{date}}, {{time}}.',
	'settings.taskTargetPath': 'Task target note',
	'settings.taskTargetPathDesc':
		'Where the generated tasks are written. Empty means the daily note of that day.',
	'settings.exportFolder': 'Export folder',
	'settings.exportFolderDesc':
		'Where the exported .ics files are written. Empty means the vault root.',

	'command.generateWeeklyReport': 'Generate weekly report',
	'command.generateMonthlyReport': 'Generate monthly report',
	'command.generateYearlyReport': 'Generate annual report',

	'action.weeklyReport': 'Weekly report',
	'action.weeklyReportDesc': 'Generate the weekly report for the selected week.',
	'action.monthlyReport': 'Monthly report',
	'action.monthlyReportDesc': 'Generate the monthly report for the selected month.',
	'action.yearlyReport': 'Annual report',
	'action.yearlyReportDesc': 'Generate the annual report for the selected year.',

	'notice.reportGenerating': 'Generating report…',
	'notice.reportSaved': 'Report saved to {{path}} ({{count}} items)',
	'notice.reportSavedAi': 'AI report saved to {{path}} ({{count}} items)',
	'notice.reportAiFallback': 'Report saved to {{path}} (AI skipped: {{message}})',

	'settings.ai': 'Periodic reports & AI',
	'settings.aiDesc':
		'Generate weekly, monthly and annual reports from calendar events, with optional AI narrative summaries via an OpenAI-compatible API (such as DeepSeek).',
	'settings.aiEnabled': 'Enable AI narrative summary',
	'settings.aiEnabledDesc':
		'Call the configured model when generating a periodic report. When off, reports still include the structured event overview.',
	'settings.aiBaseUrl': 'API base URL',
	'settings.aiBaseUrlDesc':
		'OpenAI-compatible endpoint base URL, e.g. https://api.deepseek.com/v1.',
	'settings.aiModel': 'Model',
	'settings.aiModelDesc': 'Model identifier, e.g. deepseek-chat.',
	'settings.aiApiKey': 'API key',
	'settings.aiApiKeyDesc':
		'Stored in Obsidian secret storage (never written to the vault settings file).',
	'settings.aiApiKeyEnv': 'API key environment variable',
	'settings.aiApiKeyEnvDesc':
		'Fallback environment variable name on desktop when no secret is stored, e.g. DEEPSEEK_API_KEY.',
	'settings.reportFolder': 'Report folder',
	'settings.reportFolderDesc':
		'Vault folder where weekly, monthly and annual reports are written.',
	'settings.weeklyFormat': 'Weekly report filename format',
	'settings.weeklyFormatDesc':
		'Pattern using YYYY, WW, MM, DD (use [W] for literal characters), e.g. YYYY-[W]WW.',
	'settings.monthlyFormat': 'Monthly report filename format',
	'settings.monthlyFormatDesc': 'Pattern for monthly reports, e.g. YYYY-MM.',
	'settings.yearlyFormat': 'Annual report filename format',
	'settings.yearlyFormatDesc': 'Pattern for annual reports, e.g. YYYY.',
	'settings.aiSystemPrompt': 'Custom system prompt',
	'settings.aiSystemPromptDesc':
		'Optional instructions for the AI model. Leave empty to use the built-in review prompt.',

	'common.enabled': 'Enabled',
	'common.disabled': 'Disabled',
	'common.save': 'Save',
	'common.cancel': 'Cancel',
} as Record<string, string>;
