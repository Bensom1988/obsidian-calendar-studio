import { ItemView, TFile, WorkspaceLeaf } from 'obsidian';
import type CalendarStudioPlugin from '../main';
import {
	buildMonthGrid,
	formatFullDate,
	formatMonthTitle,
	formatTime,
	isoWeekNumber,
	toDateKey,
	weekdayLabels,
	weekendIndexes,
} from '../core/dateUtils';
import { getLunarInfo } from '../core/lunar';
import { translate } from '../i18n';
import type { CalendarEvent } from '../core/types';

export const MONTH_VIEW_TYPE = 'calendar-studio-month';

type ViewMode = 'month' | 'agenda';

/**
 * The main calendar view: a month grid with an agenda for the selected day.
 *
 * The grid is hand-written rather than pulled from a calendar library — it
 * keeps the bundle small and the visual language consistent with the rest of
 * Obsidian.
 */
export class MonthView extends ItemView {
	private mode: ViewMode = 'month';

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: CalendarStudioPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return MONTH_VIEW_TYPE;
	}

	getDisplayText(): string {
		return translate(this.plugin.settings.language, 'plugin.name');
	}

	getIcon(): string {
		return 'calendar';
	}

	async onOpen(): Promise<void> {
		this.plugin.state.onChange(() => this.render());
		this.plugin.index.onChange(() => this.render());
		this.render();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	private t(key: string, vars?: Record<string, string | number>): string {
		return translate(this.plugin.settings.language, key, vars);
	}

	render(): void {
		const container = this.contentEl;
		container.empty();
		container.addClass('cs-root');

		const { settings, state, index } = this.plugin;
		const locale = settings.locale;

		/* ---------------------------------------------------------------- */
		/* Header                                                            */
		/* ---------------------------------------------------------------- */
		const header = container.createDiv({ cls: 'cs-header' });

		const nav = header.createDiv({ cls: 'cs-nav' });
		const prev = nav.createEl('button', {
			cls: 'cs-icon-button',
			attr: { 'aria-label': this.t('view.previousMonth') },
		});
		prev.setText('‹');
		prev.addEventListener('click', () => {
			const next = new Date(state.anchor.getFullYear(), state.anchor.getMonth() - 1, 1);
			state.setAnchor(next);
		});

		const title = header.createEl('h2', { cls: 'cs-title' });
		title.setText(formatMonthTitle(state.anchor, locale));

		const next = nav.createEl('button', {
			cls: 'cs-icon-button',
			attr: { 'aria-label': this.t('view.nextMonth') },
		});
		next.setText('›');
		next.addEventListener('click', () => {
			const following = new Date(state.anchor.getFullYear(), state.anchor.getMonth() + 1, 1);
			state.setAnchor(following);
		});

		const actions = header.createDiv({ cls: 'cs-actions' });

		const todayButton = actions.createEl('button', { cls: 'cs-button' });
		todayButton.setText(this.t('view.today'));
		todayButton.addEventListener('click', () => state.goToToday());

		const toggle = actions.createEl('button', { cls: 'cs-button cs-button-toggle' });
		toggle.setText(this.mode === 'month' ? this.t('view.agenda') : this.t('view.month'));
		toggle.addEventListener('click', () => {
			this.mode = this.mode === 'month' ? 'agenda' : 'month';
			this.render();
		});

		/* ---------------------------------------------------------------- */
		/* Toolbar — actions on the selected day                             */
		/* ---------------------------------------------------------------- */
		const toolbar = container.createDiv({ cls: 'cs-toolbar' });

		const selected = toolbar.createSpan({ cls: 'cs-toolbar-date' });
		selected.setText(formatFullDate(state.selected, locale));

		const dailyNote = toolbar.createEl('button', { cls: 'cs-button' });
		dailyNote.setText(this.t('action.createDailyNote'));
		dailyNote.setAttribute('aria-label', this.t('action.createDailyNoteDesc'));
		dailyNote.setAttribute('title', this.t('action.createDailyNoteDesc'));
		dailyNote.addEventListener('click', () => {
			void this.plugin.createDailyNote(state.selected);
		});

		const makeTasks = toolbar.createEl('button', { cls: 'cs-button' });
		makeTasks.setText(this.t('action.generateTasks'));
		makeTasks.setAttribute('aria-label', this.t('action.generateTasksDesc'));
		makeTasks.setAttribute('title', this.t('action.generateTasksDesc'));
		makeTasks.addEventListener('click', () => {
			void this.plugin.generateTasks(state.selected);
		});

		/* ---------------------------------------------------------------- */
		/* Body                                                              */
		/* ---------------------------------------------------------------- */
		const body = container.createDiv({ cls: 'cs-body' });

		if (this.mode === 'month') {
			this.renderGrid(body, locale);
		} else {
			this.renderAgenda(body, locale);
		}
	}

	private renderGrid(container: HTMLElement, locale: string): void {
		const { settings, state, index } = this.plugin;
		const grid = container.createDiv({ cls: 'cs-grid-wrap' });
		const showWeeks = settings.showWeekNumbers;

		const table = grid.createDiv({
			cls: `cs-grid${showWeeks ? ' cs-grid-weeks' : ''}`,
		});

		const labels = weekdayLabels(locale, settings.weekStart);
		const weekends = weekendIndexes(settings.weekStart);

		if (showWeeks) {
			table.createDiv({ cls: 'cs-weeknumber-head' });
		}
		labels.forEach((label, column) => {
			const cell = table.createDiv({ cls: 'cs-weekday' });
			if (weekends.includes(column)) cell.addClass('is-weekend');
			cell.setText(label);
		});

		const days = buildMonthGrid(state.anchor, settings.weekStart);
		const anchorMonth = state.anchor.getMonth();

		for (const day of days) {
			if (showWeeks) {
				const weekCell = table.createDiv({ cls: 'cs-weeknumber' });
				weekCell.setText(String(isoWeekNumber(day)));
			}

			const cell = table.createDiv({ cls: 'cs-day' });
			if (day.getMonth() !== anchorMonth) cell.addClass('is-outside');
			if (day.getDate() === new Date().getDate() && day.getMonth() === new Date().getMonth()) {
				cell.addClass('is-today');
			}
			if (toDateKey(day) === toDateKey(state.selected)) cell.addClass('is-selected');

			const head = cell.createDiv({ cls: 'cs-day-head' });
			const number = head.createSpan({ cls: 'cs-day-number' });
			number.setText(String(day.getDate()));

			if (settings.showLunar) {
				const lunar = getLunarInfo(day);
				const lunarEl = head.createSpan({ cls: 'cs-day-lunar' });
				const text = lunar.jieQi || lunar.festival || lunar.label;
				lunarEl.setText(text);
				if (lunar.jieQi || lunar.festival) lunarEl.addClass('is-highlight');
			}

			const events = index.getEventsOnDate(day);
			if (events.length > 0) {
				const dots = cell.createDiv({ cls: 'cs-dots' });
				const shown = events.slice(0, 3);
				for (const event of shown) {
					const dot = dots.createSpan({ cls: `cs-dot cs-source-${event.source}` });
					if (event.color) dot.style.setProperty('--cs-dot-color', event.color);
				}
				if (events.length > shown.length) {
					const more = dots.createSpan({ cls: 'cs-more' });
					more.setText(`+${events.length - shown.length}`);
				}
			}

			cell.addEventListener('click', () => state.select(day));
		}
	}

	private renderAgenda(container: HTMLElement, locale: string): void {
		const { settings, state, index } = this.plugin;
		const events = index.getEventsOnDate(state.selected);

		const head = container.createDiv({ cls: 'cs-agenda-head' });
		head.setText(this.t('view.agenda'));

		const list = container.createDiv({ cls: 'cs-agenda' });
		if (events.length === 0) {
			const empty = list.createDiv({ cls: 'cs-empty' });
			empty.setText(this.t('view.noEvents'));
			return;
		}

		for (const event of events) {
			list.appendChild(this.renderEvent(event, locale));
		}
	}

	private renderEvent(event: CalendarEvent, locale: string): HTMLElement {
		const row = this.contentEl.createDiv({ cls: `cs-event cs-source-${event.source}` });
		if (event.color) row.style.setProperty('--cs-event-color', event.color);

		const time = row.createDiv({ cls: 'cs-event-time' });
		time.setText(
			event.allDay
				? this.t('view.allDay')
				: formatTime(event.start, locale),
		);

		const title = row.createDiv({ cls: 'cs-event-title' });
		title.setText(event.title);

		if (event.filePath) {
			title.addClass('is-link');
			title.addEventListener('click', () => {
				const file = this.app.vault.getAbstractFileByPath(event.filePath ?? '');
				if (file instanceof TFile) {
					this.app.workspace.getLeaf(false).openFile(file);
				}
			});
		} else if (event.url) {
			title.addClass('is-link');
			title.addEventListener('click', () => window.open(event.url ?? '', '_blank'));
		}

		return row;
	}
}
