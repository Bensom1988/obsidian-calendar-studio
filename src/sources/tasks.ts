import type { App, TFile } from 'obsidian';
import type { CalendarEvent, EventSource, TasksSettings } from '../core/types';
import { toDateKey } from '../core/dateUtils';
import { parseTaskLine, taskDates, cleanText } from '../core/taskParser';
import { matchesFolder } from './folders';

/**
 * Reads task lines that carry a date.
 *
 * Both notations of the Tasks plugin are understood:
 *
 *   `- [ ] 写周报 📅 2026-10-30`      (emoji)
 *   `- [ ] 写周报 [due:: 2026-10-30]` (inline field)
 *
 * The vault can hold thousands of notes, so results are cached per file and
 * only re-read when the file changed on disk.
 */
export class TasksSource implements EventSource {
	readonly id = 'tasks';

	/** path → parsed events, valid until the file's mtime or globalFilter changes. */
	private cache = new Map<string, { mtime: number; filter: string; events: CalendarEvent[] }>();

	constructor(
		private readonly app: App,
		private readonly getSettings: () => TasksSettings,
	) {}

	async collect(): Promise<CalendarEvent[]> {
		const settings = this.getSettings();
		if (!settings.enabled) return [];

		const files = this.app.vault
			.getMarkdownFiles()
			.filter((file) => matchesFolder(file.path, settings));

		const events: CalendarEvent[] = [];
		const seen = new Set<string>();

		// Read in chunks: a vault with thousands of notes would otherwise
		// open thousands of file handles at once.
		const CHUNK = 64;
		for (let index = 0; index < files.length; index += CHUNK) {
			const chunk = files.slice(index, index + CHUNK);
			const results = await Promise.all(chunk.map((file) => this.eventsFor(file)));
			for (const fileEvents of results) {
				for (const event of fileEvents) {
					if (seen.has(event.id)) continue;
					seen.add(event.id);
					events.push(event);
				}
			}
		}

		// Drop cache entries for files that no longer exist.
		const alive = new Set(files.map((file) => file.path));
		for (const path of [...this.cache.keys()]) {
			if (!alive.has(path)) this.cache.delete(path);
		}

		return events;
	}

	private async eventsFor(file: TFile): Promise<CalendarEvent[]> {
		const filter = this.getSettings().globalFilter.trim();
		const cached = this.cache.get(file.path);
		if (cached && cached.mtime === file.stat.mtime && cached.filter === filter) {
			return cached.events;
		}

		let content: string;
		try {
			content = await this.app.vault.cachedRead(file);
		} catch (error) {
			console.error(`[calendar-studio] cannot read "${file.path}":`, error);
			return [];
		}

		const events = this.parse(file, content);
		this.cache.set(file.path, { mtime: file.stat.mtime, filter, events });
		return events;
	}

	private parse(file: TFile, content: string): CalendarEvent[] {
		const settings = this.getSettings();
		const filter = settings.globalFilter.trim();
		const events: CalendarEvent[] = [];

		const lines = content.split(/\r?\n/);
		let inManagedBlock = false;
		for (let number = 0; number < lines.length; number += 1) {
			const line = lines[number];
			if (line.includes('<!-- calendar-studio:tasks:start -->')) {
				inManagedBlock = true;
				continue;
			}
			if (line.includes('<!-- calendar-studio:tasks:end -->')) {
				inManagedBlock = false;
				continue;
			}
			if (inManagedBlock) continue;
			// The global filter decides which lines count as tasks.
			if (filter && !line.includes(filter)) continue;

			const task = parseTaskLine(line);
			if (!task) continue;

			for (const { date, field } of taskDates(task)) {
				const key = toDateKey(date);
				events.push({
					id: `tasks:${file.path}:${number + 1}:${field}:${key}`,
					source: 'tasks',
					title: cleanText(task.text, filter),
					start: date,
					allDay: true,
					filePath: file.path,
					line: number + 1,
					calendar: 'tasks',
					meta: { kind: field, status: task.status, raw: task.raw },
				});
			}
		}

		return events;
	}
}
