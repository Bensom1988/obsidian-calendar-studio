import { App, TFile, normalizePath } from 'obsidian';
import type { CalendarEvent, WorkflowSettings } from '../core/types';
import { formatDatePattern, formatTime } from '../core/dateUtils';
import { renderTemplate } from '../core/template';
import { ensureFolder } from '../core/vaultHelpers';
import { dailyNotePath } from './dailyNote';

/**
 * Turning a day's events into task lines.
 *
 * A task template file holds one template per line; `{{title}}`, `{{date}}`,
 * `{{time}}` and `{{calendar}}` are filled in per event. Without a template
 * file a sensible default is used, so the feature works out of the box.
 */

export const TASKS_START = '<!-- calendar-studio:tasks:start -->';
export const TASKS_END = '<!-- calendar-studio:tasks:end -->';

export const DEFAULT_TASK_TEMPLATE = '- [ ] {{title}} 📅 {{date}}';

export interface TaskOutcome {
	path: string;
	created: boolean;
	count: number;
}

async function readTemplateLines(app: App, path: string): Promise<string[]> {
	if (!path.trim()) return [];
	const file = app.vault.getAbstractFileByPath(normalizePath(path.trim()));
	if (!(file instanceof TFile)) return [];
	try {
		const content = await app.vault.cachedRead(file);
		return content
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && !line.startsWith('#'));
	} catch (error) {
		console.error(`[calendar-studio] cannot read task template "${path}":`, error);
		return [];
	}
}

/** The task lines a set of events produces. */
export function buildTaskLines(
	events: CalendarEvent[],
	templates: string[],
	date: Date,
	locale: string,
): string[] {
	const patterns = templates.length > 0 ? templates : [DEFAULT_TASK_TEMPLATE];
	const lines: string[] = [];
	for (const event of events) {
		for (const pattern of patterns) {
			const line = renderTemplate(pattern, {
				title: event.title,
				date,
				dateText: formatDatePattern(date, 'YYYY-MM-DD'),
				time: event.allDay ? '' : formatTime(event.start, locale),
				calendar: event.calendar ?? event.source,
			});
			if (line.trim()) lines.push(line.trim());
		}
	}
	return lines;
}

/** The marked block the plugin owns for generated tasks. */
export function tasksBlock(lines: string[]): string {
	return [TASKS_START, ...lines, TASKS_END].join('\n');
}

/** Replace the marked block, or append it when the note does not have one. */
export function upsertTaskBlock(content: string, block: string): string {
	const start = content.indexOf(TASKS_START);
	const end = content.indexOf(TASKS_END);
	if (start !== -1 && end !== -1 && end > start) {
		return content.slice(0, start) + block + content.slice(end + TASKS_END.length);
	}
	const separator = content.endsWith('\n') || content.length === 0 ? '' : '\n';
	return `${content}${separator}\n${block}\n`;
}

/**
 * Write the day's tasks into a note.
 *
 * The target is the configured note; without one the day's daily note is
 * used. Content the user wrote is never removed.
 */
export async function generateTasksForDay(
	app: App,
	date: Date,
	events: CalendarEvent[],
	settings: WorkflowSettings,
	locale = 'en-US',
): Promise<TaskOutcome> {
	const templates = await readTemplateLines(app, settings.taskTemplatePath);
	const lines = buildTaskLines(events, templates, date, locale);
	const block = tasksBlock(lines);

	const target = settings.taskTargetPath.trim()
		? normalizePath(settings.taskTargetPath.trim())
		: dailyNotePath(app, date, settings, locale);

	const folder = target.split('/').slice(0, -1).join('/');
	if (folder) await ensureFolder(app, folder);

	const existing = app.vault.getAbstractFileByPath(target);
	if (existing instanceof TFile) {
		const content = await app.vault.cachedRead(existing);
		const updated = upsertTaskBlock(content, block);
		if (updated !== content) await app.vault.modify(existing, updated);
		return { path: target, created: false, count: lines.length };
	}

	await app.vault.create(target, `${block}\n`);
	return { path: target, created: true, count: lines.length };
}
