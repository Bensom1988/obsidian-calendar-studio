import type { App } from 'obsidian';
import type {
	CalendarEvent,
	EventSource,
	FrontmatterSettings,
	PropertyRule,
} from '../core/types';
import { parseDateValue } from '../core/dateUtils';
import { matchesFolder } from './folders';

/**
 * Reads date-carrying frontmatter properties.
 *
 * Nothing about the vault is assumed: which properties exist, what they mean
 * and where they apply are all settings.
 */
export class FrontmatterSource implements EventSource {
	readonly id = 'frontmatter';

	constructor(
		private readonly app: App,
		private readonly getSettings: () => FrontmatterSettings,
	) {}

	collect(): CalendarEvent[] {
		const settings = this.getSettings();
		if (!settings.enabled || settings.rules.length === 0) return [];

		const events: CalendarEvent[] = [];

		for (const file of this.app.vault.getMarkdownFiles()) {
			if (!matchesFolder(file.path, settings)) continue;

			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (!frontmatter) continue;

			const title = this.titleOf(frontmatter, file.basename);
			const values = this.readRules(frontmatter, settings.rules);
			if (!values) continue;

			const event = this.buildEvent(file.path, title, values);
			if (event) events.push(event);
		}

		return events;
	}

	private titleOf(frontmatter: Record<string, unknown>, fallback: string): string {
		const title = frontmatter['title'];
		return typeof title === 'string' && title.trim() ? title.trim() : fallback;
	}

	/** Collect the parsed value of every configured rule. */
	private readRules(
		frontmatter: Record<string, unknown>,
		rules: PropertyRule[],
	): Map<PropertyRule['kind'], { date: Date; hasTime: boolean; property: string }> | null {
		const values = new Map<
			PropertyRule['kind'],
			{ date: Date; hasTime: boolean; property: string }
		>();
		for (const rule of rules) {
			if (!rule.property) continue;
			const parsed = parseDateValue(frontmatter[rule.property]);
			if (!parsed) continue;
			// The first rule of a kind wins, so the UI stays predictable.
			if (!values.has(rule.kind)) {
				values.set(rule.kind, { ...parsed, property: rule.property });
			}
		}
		return values.size > 0 ? values : null;
	}

	private buildEvent(
		filePath: string,
		title: string,
		values: Map<
			PropertyRule['kind'],
			{ date: Date; hasTime: boolean; property: string }
		>,
	): CalendarEvent | null {
		const start = values.get('start');
		const due = values.get('due');
		const allDay = values.get('allDay');
		const end = values.get('end');

		let eventStart: { date: Date; hasTime: boolean } | undefined;
		let eventEnd: { date: Date; hasTime: boolean } | undefined;
		let kind = 'allDay';

		if (start) {
			eventStart = start;
			eventEnd = end ?? due;
			kind = 'start';
		} else if (due) {
			eventStart = due;
			eventEnd = end;
			kind = 'due';
		} else if (allDay) {
			eventStart = allDay;
			eventEnd = end;
			kind = 'allDay';
		} else if (end) {
			eventStart = end;
			kind = 'end';
		}

		if (!eventStart) return null;

		const timed = eventStart.hasTime || (eventEnd?.hasTime ?? false);

		return {
			id: `frontmatter:${filePath}:${kind}`,
			source: 'frontmatter',
			title,
			start: eventStart.date,
			end: eventEnd?.date,
			allDay: !timed,
			filePath,
			calendar: 'frontmatter',
			meta: { kind },
		};
	}
}
