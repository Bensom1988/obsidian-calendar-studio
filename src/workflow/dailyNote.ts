import { App, TFile, normalizePath } from 'obsidian';
import type { CalendarEvent, WorkflowSettings } from '../core/types';
import { formatDatePattern, formatFullDate, formatTime } from '../core/dateUtils';
import { renderTemplate } from '../core/template';
import { ensureFolder } from '../core/vaultHelpers';

/**
 * Writing a daily note from the calendar.
 *
 * Two rules keep this safe:
 *
 *  1. The note is only ever written through the vault API — never through the
 *     file system.
 *  2. Existing content is never destroyed. The generated part lives between
 *     two markers and is replaced in place, so running the command twice does
 *     not duplicate anything.
 */

export const AGENDA_START = '<!-- calendar-studio:agenda:start -->';
export const AGENDA_END = '<!-- calendar-studio:agenda:end -->';

export const DEFAULT_DAILY_TEMPLATE = [
	'# {{title}}',
	'',
	AGENDA_START,
	'{{events}}',
	AGENDA_END,
	'',
].join('\n');

export interface DailyNoteOutcome {
	path: string;
	created: boolean;
	eventCount: number;
}

interface CoreDailyNotes {
	instance?: {
		getDailyNoteSettings?: () => { folder?: string; format?: string; template?: string };
	};
}

interface AppWithInternals {
	internalPlugins?: { getPluginById?: (id: string) => unknown };
}

/** Daily-note settings of Obsidian's own core plugin, when it is enabled. */
export function coreDailyNoteSettings(app: App): {
	folder: string;
	format: string;
	template: string;
} | null {
	const internals = (app as unknown as AppWithInternals).internalPlugins;
	const plugin = internals?.getPluginById?.('daily-notes') as CoreDailyNotes | undefined;
	const settings = plugin?.instance?.getDailyNoteSettings?.();
	if (!settings) return null;
	return {
		folder: settings.folder ?? '',
		format: settings.format ?? 'YYYY-MM-DD',
		template: settings.template ?? '',
	};
}

/**
 * Where the note for a date lives.
 *
 * Obsidian's own daily-notes settings win when they exist; otherwise the
 * plugin's fallback folder and format are used.
 */
export function dailyNotePath(
	app: App,
	date: Date,
	settings: WorkflowSettings,
	locale = 'en-US',
): string {
	const core = settings.useCoreDailyNotes ? coreDailyNoteSettings(app) : null;
	const folder = (core?.folder ?? settings.dailyNoteFolder).trim().replace(/^\/+|\/+$/g, '');
	const format = (core?.format ?? settings.dailyNoteFormat).trim() || 'YYYY-MM-DD';
	const name = formatDatePattern(date, format, locale);
	return normalizePath(folder ? `${folder}/${name}.md` : `${name}.md`);
}

/** One Markdown list item per event, timed events first. */
export function eventsToMarkdown(events: CalendarEvent[], locale: string): string {
	const sorted = [...events].sort((a, b) => {
		if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
		return a.start.getTime() - b.start.getTime();
	});
	if (sorted.length === 0) return '';
	return sorted
		.map((event) => {
			const time = event.allDay ? '' : `${formatTime(event.start, locale)} `;
			return `- ${time}${event.title}`;
		})
		.join('\n');
}

/** The marked block the plugin owns inside a note. */
export function agendaBlock(events: CalendarEvent[], locale: string): string {
	const body = eventsToMarkdown(events, locale);
	return [AGENDA_START, body, AGENDA_END].join('\n');
}

/** Replace the marked block, or append it when the note does not have one. */
export function upsertBlock(content: string, block: string): string {
	const start = content.indexOf(AGENDA_START);
	const end = content.indexOf(AGENDA_END);
	if (start !== -1 && end !== -1 && end > start) {
		return content.slice(0, start) + block + content.slice(end + AGENDA_END.length);
	}
	const separator = content.endsWith('\n') || content.length === 0 ? '' : '\n';
	return `${content}${separator}\n${block}\n`;
}

async function readTemplate(app: App, path: string): Promise<string | null> {
	if (!path.trim()) return null;
	const file = app.vault.getAbstractFileByPath(normalizePath(path.trim()));
	if (!(file instanceof TFile)) return null;
	try {
		return await app.vault.cachedRead(file);
	} catch (error) {
		console.error(`[calendar-studio] cannot read template "${path}":`, error);
		return null;
	}
}

/**
 * Create the daily note for a date, or refresh the agenda inside it.
 *
 * Never overwrites what the user wrote: only the marked block is touched.
 */
export async function createOrUpdateDailyNote(
	app: App,
	date: Date,
	events: CalendarEvent[],
	settings: WorkflowSettings,
	locale = 'en-US',
): Promise<DailyNoteOutcome> {
	const path = dailyNotePath(app, date, settings, locale);
	const block = agendaBlock(events, locale);
	const existing = app.vault.getAbstractFileByPath(path);

	if (existing instanceof TFile) {
		const content = await app.vault.cachedRead(existing);
		const updated = upsertBlock(content, block);
		if (updated !== content) await app.vault.modify(existing, updated);
		return { path, created: false, eventCount: events.length };
	}

	const template = (await readTemplate(app, settings.templatePath)) ?? DEFAULT_DAILY_TEMPLATE;
	const rendered = renderTemplate(template, {
		title: formatFullDate(date, locale),
		date,
		weekday: formatDatePattern(date, 'dddd', locale),
		events: eventsToMarkdown(events, locale),
		agenda: block,
		tasks: '',
	});

	const folder = path.split('/').slice(0, -1).join('/');
	if (folder) await ensureFolder(app, folder);

	await app.vault.create(path, rendered);
	return { path, created: true, eventCount: events.length };
}
