import { ItemView, WorkspaceLeaf } from 'obsidian';
import type CalendarStudioPlugin from '../main';
import {
	buildMonthGrid,
	formatMonthTitle,
	toDateKey,
	weekdayLabels,
	weekendIndexes,
} from '../core/dateUtils';
import { getLunarInfo } from '../core/lunar';
import { translate } from '../i18n';

export const MINI_VIEW_TYPE = 'calendar-studio-mini';

/**
 * Compact month grid for the sidebar.
 *
 * Shows only what is useful at a glance: the month, the day numbers, and a
 * marker for days that carry events. Selecting a day here drives the main
 * view.
 */
export class MiniCalendarView extends ItemView {
	private unsubState: (() => void) | null = null;
	private unsubIndex: (() => void) | null = null;
	private rafId: number | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: CalendarStudioPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return MINI_VIEW_TYPE;
	}

	getDisplayText(): string {
		return translate(this.plugin.settings.language, 'ribbon.miniCalendar');
	}

	getIcon(): string {
		return 'calendar-days';
	}

	async onOpen(): Promise<void> {
		this.unsubState = this.plugin.state.onChange(() => this.scheduleRender());
		this.unsubIndex = this.plugin.index.onChange(() => this.scheduleRender());
		this.render();
	}

	async onClose(): Promise<void> {
		this.unsubState?.();
		this.unsubIndex?.();
		this.unsubState = null;
		this.unsubIndex = null;
		if (this.rafId !== null) {
			window.cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
		this.contentEl.empty();
	}

	private scheduleRender(): void {
		if (this.rafId !== null) return;
		this.rafId = window.requestAnimationFrame(() => {
			this.rafId = null;
			this.render();
		});
	}

	private t(key: string): string {
		return translate(this.plugin.settings.language, key);
	}

	render(): void {
		const container = this.contentEl;
		container.empty();
		container.addClass('cs-root', 'cs-mini');

		const { settings, state, index } = this.plugin;

		const header = container.createDiv({ cls: 'cs-mini-header' });
		const prev = header.createEl('button', { cls: 'cs-icon-button' });
		prev.setText('‹');
		prev.addEventListener('click', () => {
			state.setAnchor(new Date(state.anchor.getFullYear(), state.anchor.getMonth() - 1, 1));
		});

		const title = header.createDiv({ cls: 'cs-mini-title' });
		title.setText(formatMonthTitle(state.anchor, settings.locale));

		const next = header.createEl('button', { cls: 'cs-icon-button' });
		next.setText('›');
		next.addEventListener('click', () => {
			state.setAnchor(new Date(state.anchor.getFullYear(), state.anchor.getMonth() + 1, 1));
		});

		const grid = container.createDiv({ cls: 'cs-mini-grid' });
		const labels = weekdayLabels(settings.locale, settings.weekStart);
		const weekends = weekendIndexes(settings.weekStart);

		labels.forEach((label, column) => {
			const cell = grid.createDiv({ cls: 'cs-mini-weekday' });
			if (weekends.includes(column)) cell.addClass('is-weekend');
			cell.setText(label.slice(0, 2));
		});

		const days = buildMonthGrid(state.anchor, settings.weekStart);
		const now = new Date();

		for (const day of days) {
			const cell = grid.createDiv({ cls: 'cs-mini-day' });
			if (day.getMonth() !== state.anchor.getMonth()) cell.addClass('is-outside');
			if (toDateKey(day) === toDateKey(now)) cell.addClass('is-today');
			if (toDateKey(day) === toDateKey(state.selected)) cell.addClass('is-selected');

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

			cell.addEventListener('click', () => {
				state.select(day);
				void this.plugin.activateMainView();
			});
		}
	}
}
