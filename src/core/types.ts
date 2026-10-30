/**
 * Core data model.
 *
 * Every data source — frontmatter, task lines, filenames, CalDAV — normalises
 * into `CalendarEvent`. The index, the UI and the exporters only ever see this
 * shape, so adding a source never requires touching them.
 */

export type SourceId = 'frontmatter' | 'filename' | 'tasks' | 'caldav';

/** How a frontmatter property maps onto an event. */
export type PropertyKind = 'start' | 'due' | 'end' | 'allDay';

export interface CalendarEvent {
	/** Stable identity: `${source}:${filePath}:${kind}:${value}`. */
	id: string;
	source: SourceId;
	title: string;
	/** Local wall-clock start. All-day events start at local midnight. */
	start: Date;
	/** Optional local wall-clock end. */
	end?: Date;
	allDay: boolean;
	/** Vault file that produced this event. */
	filePath?: string;
	/** Line number inside that file, when known. */
	line?: number;
	/** External link, e.g. a CalDAV event's URL. */
	url?: string;
	/** Hex colour used in the grid and agenda. */
	color?: string;
	/** Calendar / collection name shown in the agenda. */
	calendar?: string;
	/** Extra payload for workflows; never interpreted by the core. */
	meta?: Record<string, unknown>;
}

/** A pluggable producer of events. */
export interface EventSource {
	readonly id: SourceId;
	/**
	 * Collect every event this source currently knows about.
	 *
	 * May return a promise: sources that read file contents (task lines) or
	 * talk to the network (CalDAV) cannot work synchronously.
	 */
	collect(): CalendarEvent[] | Promise<CalendarEvent[]>;
}

/** One frontmatter property mapped onto a date. */
export interface PropertyRule {
	property: string;
	kind: PropertyKind;
}

export interface FolderFilter {
	/** Empty means "everywhere". */
	include: string[];
	exclude: string[];
}

export interface FrontmatterSettings extends FolderFilter {
	enabled: boolean;
	rules: PropertyRule[];
}

export interface FilenameSettings extends FolderFilter {
	enabled: boolean;
	/** Formats such as `YYYY-MM-DD`. */
	formats: string[];
}

export interface TasksSettings extends FolderFilter {
	enabled: boolean;
	/** Global filter that marks a task line, e.g. `#task`. */
	globalFilter: string;
}

/**
 * How the plugin turns calendar actions into vault content.
 *
 * Everything here is configurable — no path, folder or format is hard-coded,
 * so the plugin works in any vault without editing the source.
 */
export interface WorkflowSettings {
	/** Follow Obsidian's own daily-notes settings when that plugin is on. */
	useCoreDailyNotes: boolean;
	/** Folder for daily notes — only used when the core plugin is off. */
	dailyNoteFolder: string;
	/** File name format — only used when the core plugin is off. */
	dailyNoteFormat: string;
	/** Optional template file; `{{date}}`, `{{events}}` … are substituted. */
	templatePath: string;
	/** Optional task template file — one task template per line. */
	taskTemplatePath: string;
	/** Where generated task lines are written. Empty = the day's daily note. */
	taskTargetPath: string;
	/** Add tasks to the target instead of replacing what is already there. */
	appendTasks: boolean;
}

export interface CalDavSettings {
	enabled: boolean;
	accounts: CalDavAccount[];
}

export interface CalDavAccount {
	id: string;
	name: string;
	url: string;
	username: string;
	password: string;
	color: string;
}

export type UiLanguage = 'en' | 'zh-CN';

export interface CalendarStudioSettings {
	language: UiLanguage;
	/** BCP-47 tag used for date formatting. */
	locale: string;
	/** 0 = Sunday, 1 = Monday. */
	weekStart: 0 | 1;
	showLunar: boolean;
	showWeekNumbers: boolean;
	frontmatter: FrontmatterSettings;
	filenames: FilenameSettings;
	tasks: TasksSettings;
	caldav: CalDavSettings;
	workflow: WorkflowSettings;
}

export const DEFAULT_PROPERTY_RULES: PropertyRule[] = [
	{ property: 'start', kind: 'start' },
	{ property: 'due', kind: 'due' },
	{ property: 'date', kind: 'allDay' },
	{ property: 'end', kind: 'end' },
];

export const DEFAULT_SETTINGS: CalendarStudioSettings = {
	language: 'en',
	locale: 'en-US',
	weekStart: 1,
	showLunar: false,
	showWeekNumbers: false,
	frontmatter: {
		enabled: true,
		include: [],
		exclude: [],
		rules: DEFAULT_PROPERTY_RULES.map((rule) => ({ ...rule })),
	},
	filenames: {
		enabled: true,
		include: [],
		exclude: [],
		formats: ['YYYY-MM-DD'],
	},
	tasks: {
		enabled: false,
		include: [],
		exclude: [],
		globalFilter: '',
	},
	caldav: {
		enabled: false,
		accounts: [],
	},
	workflow: {
		useCoreDailyNotes: true,
		dailyNoteFolder: '',
		dailyNoteFormat: 'YYYY-MM-DD',
		templatePath: '',
		taskTemplatePath: '',
		taskTargetPath: '',
		appendTasks: true,
	},
};
