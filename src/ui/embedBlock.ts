/**
 * The embedded code block.
 *
 * A note can show the calendar without opening a view:
 *
 * ```calendar-studio
 * type: agenda
 * days: 7
 * limit: 20
 * ```
 *
 * The block is a live view of the event index — when the events change, the
 * open blocks are drawn again.
 */

import { MarkdownRenderChild, type App, type MarkdownPostProcessorContext } from 'obsidian';
import type CalendarStudioPlugin from '../main';
import type { CalendarEvent, SourceId } from '../core/types';
import {
	addDays,
	buildMonthGrid,
	formatMonthTitle,
	formatTime,
	startOfDay,
	toDateKey,
	weekdayLabels,
	weekendIndexes,
} from '../core/dateUtils';
import { getLunarInfo } from '../core/lunar';

/** What the block shows. */
export type EmbedType = 'agenda' | 'day' | 'week' | 'month';

/** The options of one block, read from the code fence. */
export interface EmbedOptions {
	type: EmbedType;
	/** First day of the range; `YYYY-MM-DD` or `YYYY-MM`. Empty: today. */
	date: string;
	/** How many days the agenda reaches ahead. */
	days: number;
	/** How many events at most are shown. */
	limit: number;
	/** Only events of this calendar. Empty: every calendar. */
	calendar: string;
	/** Only events of this source. Empty: every source. */
	source: SourceId | '';
}

const VALID_SOURCES: ReadonlySet<string> = new Set([
	'frontmatter',
	'filename',
	'tasks',
	'caldav',
]);

/** Parse the content of a code fence. Unknown lines are ignored. */
export function parseEmbedOptions(source: string): EmbedOptions {
	const options: EmbedOptions = {
		type: 'agenda',
		date: '',
		days: 7,
		limit: 20,
		calendar: '',
		source: '',
	};
	for (const line of source.split(/\r?\n/)) {
		const [rawKey, ...rest] = line.split(':');
		const key = rawKey.trim().toLowerCase();
		const value = rest.join(':').trim();
		if (!key || !value) continue;
		switch (key) {
			case 'type':
				if (value === 'day' || value === 'week' || value === 'month' || value === 'agenda') {
					options.type = value;
				}
				break;
			case 'date':
				options.date = value;
				break;
			case 'days':
				options.days = toNumber(value, options.days);
				break;
			case 'limit':
				options.limit = toNumber(value, options.limit);
				break;
			case 'calendar':
				options.calendar = value;
				break;
			case 'source':
				if (VALID_SOURCES.has(value)) {
					options.source = value as SourceId;
				}
				break;
			default:
				break;
		}
	}
	if (options.days < 1) options.days = 1;
	if (options.limit < 1) options.limit = 1;
	return options;
}

function toNumber(value: string, fallback: number): number {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : fallback;
}

/** The range of dates a block shows. */
export function embedRange(
	options: EmbedOptions,
	today: Date,
): { start: Date; end: Date } {
	const base = options.date ? parseDate(options.date) ?? startOfDay(today) : startOfDay(today);
	if (options.type === 'day') {
		return { start: base, end: addDays(base, 1) };
	}
	if (options.type === 'week') {
		return { start: base, end: addDays(base, 7) };
	}
	if (options.type === 'month') {
		const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
		return {
			start: monthStart,
			end: new Date(base.getFullYear(), base.getMonth() + 1, 1),
		};
	}
	return { start: base, end: addDays(base, options.days) };
}

function parseDate(value: string): Date | undefined {
	const full = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value.trim());
	if (full) {
		const date = new Date(Number(full[1]), Number(full[2]) - 1, Number(full[3]));
		return Number.isNaN(date.getTime()) ? undefined : date;
	}
	const ym = /^(\d{4})-(\d{1,2})$/.exec(value.trim());
	if (ym) {
		const date = new Date(Number(ym[1]), Number(ym[2]) - 1, 1);
		return Number.isNaN(date.getTime()) ? undefined : date;
	}
	return undefined;
}

/** The events of the range, sorted by their start. */
export function selectEvents(
	events: CalendarEvent[],
	range: { start: Date; end: Date },
	options: EmbedOptions,
): CalendarEvent[] {
	const selected = events.filter((event) => {
		const start = event.start.getTime();
		if (start < range.start.getTime() || start >= range.end.getTime()) return false;
		if (options.calendar && event.calendar !== options.calendar) return false;
		if (options.source && event.source !== options.source) return false;
		return true;
	});
	selected.sort((a, b) => a.start.getTime() - b.start.getTime());
	return selected.slice(0, options.limit);
}

/** The live block inside a note. */
export class CalendarStudioBlock extends MarkdownRenderChild {
	constructor(
		private app: App,
		private plugin: CalendarStudioPlugin,
		private options: EmbedOptions,
		containerEl: HTMLElement,
	) {
		super(containerEl);
	}

	onunload(): void {
		this.plugin.unregisterEmbedBlock(this);
	}

	/** Draw the block again. */
	render(): void {
		const container = this.containerEl;
		container.empty();
		container.addClass('cs-root', 'cs-embed');

		const { index, settings } = this.plugin;
		const locale = settings.locale;
		const today = new Date();
		const range = embedRange(this.options, today);
		const events = selectEvents(index.getAll(), range, this.options);

		const head = container.createDiv({ cls: 'cs-embed-head' });
		const titleEl = head.createSpan({ cls: 'cs-embed-head-title' });
		titleEl.setText(
			this.options.type === 'month'
				? formatMonthTitle(range.start, locale)
				: this.plugin.t('embed.agenda'),
		);
		const count = head.createSpan({ cls: 'cs-embed-count' });
		count.setText(this.plugin.t('view.eventsCount', { count: events.length }));

		if (this.options.type === 'month') {
			this.renderMonthGrid(container, range.start, today);
		}

		if (events.length === 0) {
			const empty = container.createDiv({ cls: 'cs-embed-empty' });
			empty.setText(this.plugin.t('view.noEvents'));
			return;
		}

		const list = container.createDiv({ cls: 'cs-embed-list' });
		for (const event of events) {
			list.appendChild(this.renderEvent(event, locale));
		}
	}

	private renderMonthGrid(container: HTMLElement, anchor: Date, today: Date): void {
		const { settings, index } = this.plugin;
		const grid = container.createDiv({ cls: 'cs-mini-grid cs-embed-grid' });
		const labels = weekdayLabels(settings.locale, settings.weekStart);
		const weekends = weekendIndexes(settings.weekStart);

		labels.forEach((label, column) => {
			const cell = grid.createDiv({ cls: 'cs-mini-weekday' });
			if (weekends.includes(column)) cell.addClass('is-weekend');
			cell.setText(label.slice(0, 2));
		});

		const days = buildMonthGrid(anchor, settings.weekStart);
		for (const day of days) {
			const cell = grid.createDiv({ cls: 'cs-mini-day' });
			if (day.getMonth() !== anchor.getMonth()) cell.addClass('is-outside');
			if (toDateKey(day) === toDateKey(today)) cell.addClass('is-today');

			const number = cell.createSpan({ cls: 'cs-mini-number' });
			number.setText(String(day.getDate()));

			if (settings.showLunar) {
				const lunar = getLunarInfo(day);
				const lunarEl = cell.createSpan({ cls: 'cs-mini-lunar' });
				lunarEl.setText(lunar.shortLabel);
			}

			if (index.getEventsOnDate(day).length > 0) {
				cell.createSpan({ cls: 'cs-mini-dot' });
			}
		}
	}

	private renderEvent(event: CalendarEvent, locale: string): HTMLElement {
		const row = this.containerEl.createDiv({ cls: `cs-embed-event cs-source-${event.source}` });
		if (event.color) row.style.setProperty('--cs-event-color', event.color);

		const date = row.createDiv({ cls: 'cs-embed-date' });
		date.setText(
			event.allDay
				? `${formatDateShort(event.start, locale)} · ${this.plugin.t('view.allDay')}`
				: `${formatDateShort(event.start, locale)} ${formatTime(event.start, locale)}`,
		);

		const title = row.createDiv({ cls: 'cs-embed-title' });
		title.setText(event.title);

		if (event.filePath) {
			title.addClass('is-link');
			title.addEventListener('click', () => {
				void this.app.workspace.openLinkText(
					event.filePath ?? '',
					'',
					true,
				);
			});
		} else if (event.url) {
			title.addClass('is-link');
			title.addEventListener('click', () => window.open(event.url ?? '', '_blank'));
		}

		if (event.calendar) {
			const badge = row.createDiv({ cls: 'cs-embed-calendar' });
			badge.setText(event.calendar);
		}
		return row;
	}
}

function formatDateShort(date: Date, locale: string): string {
	try {
		return new Intl.DateTimeFormat(locale, {
			month: 'numeric',
			day: 'numeric',
		}).format(date);
	} catch {
		return `${date.getMonth() + 1}/${date.getDate()}`;
	}
}

/**
 * Register the code block processor.
 *
 * The block is registered for the language `calendar-studio`, so a note
 * writes it as a fenced block with that name.
 */
export function registerCalendarStudioBlocks(plugin: CalendarStudioPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor(
		'calendar-studio',
		(source: string, element: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			const block = new CalendarStudioBlock(
				plugin.app,
				plugin,
				parseEmbedOptions(source),
				element,
			);
			ctx.addChild(block);
			plugin.registerEmbedBlock(block);
			block.render();
		},
	);
}
