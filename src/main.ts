import { Notice, Plugin, TFile, WorkspaceLeaf, normalizePath } from 'obsidian';
import { EventIndex } from './core/eventIndex';
import { CalendarState } from './core/calendarState';
import { FrontmatterSource } from './sources/frontmatter';
import { FilenameSource } from './sources/filename';
import { TasksSource } from './sources/tasks';
import { CalDavSource } from './sources/caldav';
import {
	CalDavService,
	describeError,
	type CalDavHost,
	type CalDavSyncRange,
} from './caldav/service';
import { CredentialStore } from './caldav/credentials';
import { createObsidianFetch } from './caldav/http';
import { createCalDavClient } from './caldav/client';
import {
	FULL_CALENDAR_PLUGIN_ID,
	groupFullCalendarSources,
	type FullCalendarSource,
} from './caldav/importFullCalendar';

/** What an import from the other plugin changed. */
export interface ImportSummary {
	/** Accounts that were added. */
	imported: number;
	/** Accounts that were already there and got refreshed. */
	updated: number;
	/** Accounts whose password was found in the secret storage. */
	passwords: number;
}
import { MonthView, MONTH_VIEW_TYPE } from './ui/monthView';
import { CalendarStudioBlock, registerCalendarStudioBlocks } from './ui/embedBlock';
import { buildIcs, icsFileName } from './export/ics';
import { MiniCalendarView, MINI_VIEW_TYPE } from './ui/miniCalendar';
import { CalendarStudioSettingTab } from './settingsTab';
import { translate } from './i18n';
import { createOrUpdateDailyNote } from './workflow/dailyNote';
import { generateTasksForDay } from './workflow/taskGenerator';
import { generatePeriodicReport, reportPeriodRange } from './workflow/reportGenerator';
import { createAiClient, resolveAiApiKey } from './ai/client';
import {
	DEFAULT_SETTINGS,
	type CalendarStudioSettings,
	type CalDavAccount,
	type CalDavSettings,
	type EventSource,
	type ReportPeriod,
} from './core/types';
import { addMonths, startOfDay } from './core/dateUtils';
import { ensureFolder } from './core/vaultHelpers';

export default class CalendarStudioPlugin extends Plugin implements CalDavHost {
	settings!: CalendarStudioSettings;

	/** Fetches external calendars and owns their events. */
	caldav!: CalDavService;

	/** Keeps the CalDAV passwords out of the vault. */
	readonly credentials = new CredentialStore(this.app);

	/** Every known event, grouped by day. */
	readonly index = new EventIndex();

	/** Shared selection and visible month. */
	readonly state = new CalendarState();

	private ribbonIcon: HTMLElement | null = null;

	/** Handle of the automatic CalDAV sync timer. */
	private autoSyncTimer: number | null = null;

	/**
	 * Queue of the settings writes.
	 *
	 * Two overlapping `saveData` calls truncate each other's file, which
	 * leaves an empty `data.json` behind. Every write therefore waits for
	 * the previous one.
	 */
	private saveQueue: Promise<void> = Promise.resolve();

	/** The code blocks inside notes that show the calendar. */
	private embedBlocks: CalendarStudioBlock[] = [];

	async onload(): Promise<void> {
		await this.loadSettings();
		// The CalDAV client talks to the server through Obsidian's own
		// request function — the browser one is stopped by CORS.
		this.caldav = new CalDavService(this, (account) =>
			createCalDavClient(account, createObsidianFetch()),
		);

		this.registerView(MONTH_VIEW_TYPE, (leaf: WorkspaceLeaf) => new MonthView(leaf, this));
		this.registerView(MINI_VIEW_TYPE, (leaf: WorkspaceLeaf) => new MiniCalendarView(leaf, this));

		this.addSettingTab(new CalendarStudioSettingTab(this.app, this));
		registerCalendarStudioBlocks(this);

		this.ribbonIcon = this.addRibbonIcon(
			'calendar',
			translate(this.settings.language, 'ribbon.calendar'),
			() => {
				void this.activateMainView();
			},
		);

		this.addCommand({
			id: 'open-calendar-view',
			name: translate(this.settings.language, 'command.openCalendar'),
			callback: () => {
				void this.activateMainView();
			},
		});

		this.addCommand({
			id: 'open-mini-calendar',
			name: translate(this.settings.language, 'command.openMiniCalendar'),
			callback: () => {
				void this.openMiniCalendar();
			},
		});

		this.addCommand({
			id: 'go-to-today',
			name: translate(this.settings.language, 'command.goToToday'),
			callback: () => {
				this.state.goToToday();
				void this.activateMainView();
			},
		});

		this.addCommand({
			id: 'create-daily-note',
			name: translate(this.settings.language, 'command.createDailyNote'),
			callback: () => {
				void this.createDailyNote(this.state.selected);
			},
		});

		this.addCommand({
			id: 'generate-tasks',
			name: translate(this.settings.language, 'command.generateTasks'),
			callback: () => {
				void this.generateTasks(this.state.selected);
			},
		});

		this.addCommand({
			id: 'export-ics',
			name: translate(this.settings.language, 'command.exportIcs'),
			callback: () => {
				void this.exportIcs();
			},
		});

		this.addCommand({
			id: 'generate-weekly-report',
			name: translate(this.settings.language, 'command.generateWeeklyReport'),
			callback: () => {
				void this.generateReport(this.state.selected, 'week');
			},
		});

		this.addCommand({
			id: 'generate-monthly-report',
			name: translate(this.settings.language, 'command.generateMonthlyReport'),
			callback: () => {
				void this.generateReport(this.state.selected, 'month');
			},
		});

		this.addCommand({
			id: 'generate-yearly-report',
			name: translate(this.settings.language, 'command.generateYearlyReport'),
			callback: () => {
				void this.generateReport(this.state.selected, 'year');
			},
		});

		this.addCommand({
			id: 'sync-caldav',
			name: translate(this.settings.language, 'command.syncCalDav'),
			callback: () => {
				void this.syncCalDav();
			},
		});

		this.buildSources();
		this.startAutoSync();
		// A note with a calendar block follows the index.
		this.index.onChange(() => this.refreshEmbedBlocks());

		// Frontmatter changes surface through the metadata cache, file edits
		// through the vault. Both only schedule a rebuild — the index itself
		// coalesces them.
		this.registerEvent(
			this.app.metadataCache.on('changed', () => this.index.scheduleRebuild()),
		);
		this.registerEvent(this.app.vault.on('create', () => this.index.scheduleRebuild()));
		this.registerEvent(this.app.vault.on('delete', () => this.index.scheduleRebuild()));
		this.registerEvent(this.app.vault.on('rename', () => this.index.scheduleRebuild()));

		this.app.workspace.onLayoutReady(() => {
			void this.openMiniCalendar();
		});

		// Show the last known schedule right away, then refresh it in the
		// background — the calendar must never wait for the network.
		if (this.settings.caldav.enabled) {
			void this.caldav.restoreFromCache().then(() => this.syncCalDav(true));
		}
	}

	onunload(): void {
		if (this.autoSyncTimer !== null) {
			window.clearInterval(this.autoSyncTimer);
			this.autoSyncTimer = null;
		}
		this.index.scheduleRebuild(0);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		// Nested objects need their own merge so a settings file written by an
		// older version never leaves a source half-configured.
		this.settings.frontmatter = Object.assign(
			{},
			DEFAULT_SETTINGS.frontmatter,
			this.settings.frontmatter ?? {},
		);
		this.settings.filenames = Object.assign(
			{},
			DEFAULT_SETTINGS.filenames,
			this.settings.filenames ?? {},
		);
		this.settings.tasks = Object.assign(
			{},
			DEFAULT_SETTINGS.tasks,
			this.settings.tasks ?? {},
		);
		this.settings.caldav = Object.assign(
			{},
			DEFAULT_SETTINGS.caldav,
			this.settings.caldav ?? {},
		);
		this.settings.workflow = Object.assign(
			{},
			DEFAULT_SETTINGS.workflow,
			this.settings.workflow ?? {},
		);
		this.settings.ai = Object.assign(
			{},
			DEFAULT_SETTINGS.ai,
			this.settings.ai ?? {},
		);

		// Accounts written by an older version have no calendar list yet.
		for (const account of this.settings.caldav.accounts ?? []) {
			if (!Array.isArray(account.calendars)) account.calendars = [];
			if (account.authMethod !== 'digest') account.authMethod = 'basic';
			// A password from an older version still sits in the settings
			// file; move it into the credential store.
			if (account.password && this.credentials.secure) {
				this.credentials.set(account.id, account.password);
				account.password = '';
			}
		}
	}

	async saveSettings(): Promise<void> {
		this.saveQueue = this.saveQueue.then(async () => {
			await this.saveData(this.settings);
		});
		await this.saveQueue;
		// Recreating the sources already triggers a fresh index.
		this.buildSources();
		this.startAutoSync();
		this.refreshEmbedBlocks();
		if (this.ribbonIcon) {
			this.ribbonIcon.setAttribute(
				'aria-label',
				translate(this.settings.language, 'ribbon.calendar'),
			);
		}
	}

	/** Recreate the sources from the current settings and refresh the index. */
	private buildSources(): void {
		const sources: EventSource[] = [
			new FrontmatterSource(this.app, () => this.settings.frontmatter),
			new FilenameSource(this.app, () => this.settings.filenames),
			new TasksSource(this.app, () => this.settings.tasks),
		];
		if (this.settings.caldav.enabled) {
			sources.push(new CalDavSource(this.caldav));
		}
		this.index.setSources(sources);
	}

	/** The CalDAV settings, as the sync service sees them. */
	get caldavSettings(): CalDavSettings {
		return this.settings.caldav;
	}

	/** The events of an external calendar changed — refresh the index. */
	onEventsChanged(): void {
		this.index.scheduleRebuild();
	}

	/** Translate a key with the language of the interface. */
	t(key: string, vars?: Record<string, string | number>): string {
		return translate(this.settings.language, key, vars);
	}

	/** Remember a code block so it can be drawn again after a change. */
	registerEmbedBlock(block: CalendarStudioBlock): void {
		this.embedBlocks.push(block);
	}

	unregisterEmbedBlock(block: CalendarStudioBlock): void {
		this.embedBlocks = this.embedBlocks.filter((item) => item !== block);
	}

	/**
	 * Write the events of the current month into an `.ics` file.
	 *
	 * The file lands in the vault so it can be shared, synced or imported
	 * by another program.
	 */
	async exportIcs(): Promise<void> {
		const language = this.settings.language;
		const anchor = this.state.anchor;
		const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
		const to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
		const events = this.index.getEventsInRange(from, to);
		if (events.length === 0) {
			new Notice(translate(language, 'notice.icsEmpty'));
			return;
		}
		const folder = this.settings.workflow.exportFolder.trim();
		const path = normalizePath(
			folder
				? `${folder}/${icsFileName('calendar', anchor)}`
				: icsFileName('calendar', anchor),
		);
		const content = buildIcs(events, {
			name: translate(language, 'export.icsName'),
		});
		try {
			if (folder) {
				await ensureFolder(this.app, folder);
			}
			const existing = this.app.vault.getAbstractFileByPath(path);
			if (existing instanceof TFile) {
				await this.app.vault.modify(existing, content);
			} else {
				await this.app.vault.create(path, content);
			}
			new Notice(translate(language, 'notice.icsExported', { count: events.length, path }));
		} catch (error) {
			console.error('[calendar-studio] ICS export failed:', error);
			new Notice(translate(language, 'notice.icsFailed'));
		}
	}

	/** Draw the code blocks again — the events have changed. */
	refreshEmbedBlocks(): void {
		for (const block of this.embedBlocks) {
			try {
				block.render();
			} catch {
				// A block that cannot be drawn must not break the others.
			}
		}
	}

	/** Title used for external events that have no summary. */
	fallbackTitle(): string {
		return translate(this.settings.language, 'view.untitled');
	}

	/** The window fetched from the server: the visible month and its neighbours. */
	calDavRange(): CalDavSyncRange {
		const months = Math.max(0, this.settings.caldav.rangeMonths);
		const anchor = this.state.anchor;
		return {
			start: startOfDay(addMonths(anchor, -months)),
			end: startOfDay(addMonths(anchor, months + 1)),
		};
	}

	/** Refresh the external calendars. */
	async syncCalDav(silent = false): Promise<void> {
		const language = this.settings.language;
		if (!this.settings.caldav.enabled) {
			if (!silent) new Notice(translate(language, 'notice.caldavDisabled'));
			return;
		}
		try {
			const report = await this.caldav.sync(this.calDavRange());
			const failed = report.accounts.filter((account) => account.error);
			if (failed.length > 0) {
				console.error('[calendar-studio] caldav sync failed:', failed);
				if (!silent) {
					new Notice(
						translate(language, 'notice.caldavTestFailed', {
							message: failed[0].error ?? '',
						}),
					);
				}
				return;
			}
			if (!silent) {
				new Notice(
					translate(language, 'notice.caldavSynced', { count: report.events }),
				);
			}
		} catch (error) {
			console.error('[calendar-studio] caldav sync failed:', error);
			if (!silent) new Notice(translate(language, 'notice.failed'));
		}
	}

	/** The password of an account: the secure store first, the settings file second. */
	async resolvePassword(account: CalDavAccount): Promise<string> {
		return this.credentials.get(account.id) ?? account.password ?? '';
	}

	/** Store the password of an account — securely when the vault allows it. */
	async setCalDavPassword(account: CalDavAccount, password: string): Promise<void> {
		const stored = this.credentials.set(account.id, password);
		if (stored) {
			// The password lives in the credential store now; the settings file
			// must not keep a copy of it.
			account.password = '';
		} else {
			account.password = password;
		}
		await this.saveSettings();
	}

	/**
	 * Import the accounts of Full Calendar Remastered.
	 *
	 * The other plugin keeps its passwords in Obsidian's secret storage, so
	 * the import reads them from there as well — the user does not have to
	 * type them again.
	 */
	async importFullCalendarAccounts(): Promise<ImportSummary> {
		const path = `${this.app.vault.configDir}/plugins/${FULL_CALENDAR_PLUGIN_ID}/data.json`;
		let sources: FullCalendarSource[] = [];
		try {
			const raw = await this.app.vault.adapter.read(path);
			const parsed = JSON.parse(raw) as { calendarSources?: FullCalendarSource[] };
			sources = parsed.calendarSources ?? [];
		} catch {
			return { imported: 0, updated: 0, passwords: 0 };
		}

		const groups = groupFullCalendarSources(sources);
		const summary: ImportSummary = { imported: 0, updated: 0, passwords: 0 };
		for (const group of groups) {
			// An account that is already there is updated instead of copied,
			// so importing twice does not create a second copy.
			const existing = this.settings.caldav.accounts.find(
				(account) => account.url === group.url && account.username === group.username,
			);
			const account: CalDavAccount = existing ?? {
				id: `caldav-${Date.now()}-${summary.imported}`,
				name: group.name,
				url: group.url,
				username: group.username,
				password: '',
				color: group.color,
				authMethod: 'basic',
				calendars: [],
			};
			account.name = group.name;
			account.calendars = group.calendars;

			for (const secretId of group.secretIds) {
				const secret = this.app.secretStorage?.getSecret(secretId);
				if (secret) {
					this.credentials.set(account.id, secret);
					summary.passwords += 1;
					break;
				}
			}

			if (existing) {
				summary.updated += 1;
			} else {
				this.settings.caldav.accounts.push(account);
				summary.imported += 1;
			}
		}
		await this.saveSettings();
		return summary;
	}

	/** Check one account: connect to it and list its calendars. */
	async testCalDavAccount(account: CalDavAccount): Promise<void> {
		const language = this.settings.language;
		try {
			new Notice(translate(language, 'notice.caldavTesting'));
			const calendars = await this.caldav.discoverCalendars(account);
			account.lastError = undefined;
			await this.saveSettings();
			new Notice(translate(language, 'notice.caldavTestOk', { count: calendars.length }));
		} catch (error) {
			const message = describeError(error);
			account.lastError = message;
			await this.saveSettings();
			new Notice(translate(language, 'notice.caldavTestFailed', { message }));
		}
	}

	/** (Re)start the timer that refreshes external calendars. */
	private startAutoSync(): void {
		if (this.autoSyncTimer !== null) {
			window.clearInterval(this.autoSyncTimer);
			this.autoSyncTimer = null;
		}
		const minutes = this.settings.caldav.autoSyncMinutes;
		if (!this.settings.caldav.enabled || minutes <= 0) return;
		this.autoSyncTimer = window.setInterval(() => {
			void this.syncCalDav(true);
		}, minutes * 60 * 1000);
		this.registerInterval(this.autoSyncTimer);
	}

	/** Create — or refresh — the daily note of a date. */
	async createDailyNote(date: Date): Promise<void> {
		const language = this.settings.language;
		try {
			const outcome = await createOrUpdateDailyNote(
				this.app,
				date,
				this.index.getEventsOnDate(date),
				this.settings.workflow,
				this.settings.locale,
			);
			new Notice(`${translate(language, 'notice.dailyNote')}: ${outcome.path}`);
			const file = this.app.vault.getAbstractFileByPath(outcome.path);
			if (file instanceof TFile) {
				await this.app.workspace.getLeaf(false).openFile(file);
			}
		} catch (error) {
			console.error('[calendar-studio] daily note failed:', error);
			new Notice(translate(language, 'notice.failed'));
		}
	}

	/** Write the day's events into a note as task lines. */
	async generateTasks(date: Date): Promise<void> {
		const language = this.settings.language;
		try {
			const outcome = await generateTasksForDay(
				this.app,
				date,
				this.index.getEventsOnDate(date),
				this.settings.workflow,
				this.settings.locale,
			);
			new Notice(
				`${translate(language, 'notice.tasks')}: ${outcome.count} → ${outcome.path}`,
			);
		} catch (error) {
			console.error('[calendar-studio] task generation failed:', error);
			new Notice(translate(language, 'notice.failed'));
		}
	}

	/** Read the AI API key stored in Obsidian's secret storage, if any. */
	getAiApiKey(): string {
		return this.credentials.get('ai-api-key') ?? '';
	}

	/** Save the AI API key into Obsidian's secret storage. */
	setAiApiKey(apiKey: string): boolean {
		return this.credentials.set('ai-api-key', apiKey);
	}

	/** Generate a weekly, monthly or annual report note around `date`. */
	async generateReport(date: Date, period: ReportPeriod): Promise<void> {
		const language = this.settings.language;
		try {
			if (this.settings.ai.enabled) {
				new Notice(translate(language, 'notice.reportGenerating'));
			}
			const range = reportPeriodRange(date, period, this.settings.weekStart);
			const events = this.index.getEventsInRange(range.from, range.to);
			const apiKey = resolveAiApiKey({
				secretKey: this.getAiApiKey(),
				envVarName: this.settings.ai.apiKeyEnv,
			});
			const aiClient =
				this.settings.ai.enabled && apiKey
					? createAiClient(
							{
								baseUrl: this.settings.ai.baseUrl,
								model: this.settings.ai.model,
								apiKey,
							},
							createObsidianFetch(),
						)
					: null;

			const outcome = await generatePeriodicReport({
				app: this.app,
				date,
				period,
				weekStart: this.settings.weekStart,
				events,
				settings: this.settings.ai,
				locale: this.settings.locale,
				language,
				aiClient,
			});

			if (outcome.aiError) {
				new Notice(
					translate(language, 'notice.reportAiFallback', {
						path: outcome.path,
						message: outcome.aiError,
					}),
				);
			} else if (outcome.usedAi) {
				new Notice(
					translate(language, 'notice.reportSavedAi', {
						path: outcome.path,
						count: outcome.eventCount,
					}),
				);
			} else {
				new Notice(
					translate(language, 'notice.reportSaved', {
						path: outcome.path,
						count: outcome.eventCount,
					}),
				);
			}

			const file = this.app.vault.getAbstractFileByPath(outcome.path);
			if (file instanceof TFile) {
				await this.app.workspace.getLeaf(false).openFile(file);
			}
		} catch (error) {
			console.error('[calendar-studio] report generation failed:', error);
			new Notice(translate(language, 'notice.failed'));
		}
	}

	async activateMainView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(MONTH_VIEW_TYPE)[0];
		if (!leaf) {
			leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf();
			await leaf.setViewState({ type: MONTH_VIEW_TYPE, active: true });
		}
		await workspace.revealLeaf(leaf);
	}

	async openMiniCalendar(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(MINI_VIEW_TYPE)[0];
		if (existing) {
			await workspace.revealLeaf(existing);
			return;
		}
		const leaf = workspace.getLeftLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: MINI_VIEW_TYPE, active: false });
	}
}
