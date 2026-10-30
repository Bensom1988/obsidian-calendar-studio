export default {
	'plugin.name': 'Calendar Studio',

	'ribbon.calendar': 'Open calendar',
	'ribbon.miniCalendar': 'Open mini calendar',

	'command.openCalendar': 'Open calendar view',
	'command.openMiniCalendar': 'Open mini calendar in sidebar',
	'command.goToToday': 'Go to today',
	'command.createDailyNote': 'Create the daily note of the selected day',
	'command.generateTasks': 'Turn the selected day into tasks',

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
	'action.createDailyNote': 'Daily note',
	'action.createDailyNoteDesc': 'Create the note of this day from a template.',
	'action.generateTasks': 'Make tasks',
	'action.generateTasksDesc': 'Write this day’s events into a note as tasks.',

	'notice.dailyNote': 'Daily note',
	'notice.tasks': 'Tasks written',
	'notice.failed': 'Something went wrong — see the console for details.',

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

	'common.enabled': 'Enabled',
	'common.disabled': 'Disabled',
	'common.save': 'Save',
	'common.cancel': 'Cancel',
} as Record<string, string>;
