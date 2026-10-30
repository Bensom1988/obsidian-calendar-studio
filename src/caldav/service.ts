/**
 * The CalDAV sync service.
 *
 * It owns everything that happens between the network and the calendar:
 * discovering calendars, fetching events for a window, expanding recurrences,
 * keeping an offline cache and reporting what happened.
 *
 * The service never touches the network on its own — the plugin asks for a
 * sync, which keeps the index rebuilds cheap and the UI predictable.
 */

import type { App } from 'obsidian';
import type { CalendarEvent, CalDavAccount, CalDavSettings } from '../core/types';
import { createCalDavClient, type CalDavClientLike, type CalDavCalendarInfo } from './client';
import { parseIcs } from './ics';
import { readCache, writeCache } from './cache';

export interface CalDavSyncRange {
	start: Date;
	end: Date;
}

export interface CalDavAccountReport {
	id: string;
	name: string;
	calendars: number;
	events: number;
	error?: string;
}

export interface CalDavSyncReport {
	events: number;
	accounts: CalDavAccountReport[];
	/** Wall-clock time of the sync. */
	at: number;
}

/** What the service needs from the plugin. */
export interface CalDavHost {
	readonly app: App;
	readonly caldavSettings: CalDavSettings;
	/** Persist the settings (account state, selection). */
	saveSettings(): Promise<void>;
	/** The calendar's events changed — rebuild the index. */
	onEventsChanged(): void;
	/** Localised fallback title for events without a summary. */
	fallbackTitle(): string;
	/** The password of an account, taken from the secure credential store. */
	resolvePassword(account: CalDavAccount): Promise<string>;
}

export class CalDavService {
	private events: CalendarEvent[] = [];
	private lastSyncAt?: number;
	private syncing = false;
	/** Injected in tests; the real client is created per account. */
	private createClient: (account: CalDavAccount) => CalDavClientLike;

	constructor(
		private host: CalDavHost,
		createClient?: (account: CalDavAccount) => CalDavClientLike,
	) {
		this.createClient = createClient ?? createCalDavClient;
	}

	/** The events currently known — from the last sync or from the cache. */
	getEvents(): CalendarEvent[] {
		return this.events;
	}

	getLastSyncAt(): number | undefined {
		return this.lastSyncAt;
	}

	isSyncing(): boolean {
		return this.syncing;
	}

	/** Load the offline cache so the calendar has something to show. */
	async restoreFromCache(): Promise<number> {
		const cached = await readCache(this.host.app);
		if (cached.length === 0) return 0;
		this.events = cached;
		this.host.onEventsChanged();
		return cached.length;
	}

	/**
	 * Fetch every selected calendar of every enabled account.
	 *
	 * One failing account never stops the others: the report says what went
	 * wrong and the calendar keeps the events it already had.
	 */
	async sync(range: CalDavSyncRange): Promise<CalDavSyncReport> {
		if (this.syncing) {
			return { events: this.events.length, accounts: [], at: Date.now() };
		}
		this.syncing = true;

		const accounts = this.host.caldavSettings.accounts ?? [];
		const reports: CalDavAccountReport[] = [];
		const collected: CalendarEvent[] = [];

		for (const account of accounts) {
			if (!account.url) continue;
			try {
				const client = await this.clientFor(account);
				// The collections the user picked are the ones that are
				// read — no discovery is needed for a sync.
				const selected = (account.calendars ?? []).filter((calendar) => calendar.selected);
				let count = 0;
				for (const calendar of selected) {
					const documents = await client.fetchEvents(calendar.url, range);
					for (const document of documents) {
						const events = parseIcs(document, {
							accountId: account.id,
							calendarName: calendar.name,
							color: calendar.color ?? account.color ?? undefined,
							range,
							fallbackTitle: this.host.fallbackTitle(),
						});
						collected.push(...events);
						count += events.length;
					}
				}
				account.lastSyncAt = Date.now();
				account.lastError = undefined;
				reports.push({
					id: account.id,
					name: account.name || account.url,
					calendars: selected.length,
					events: count,
				});
			} catch (error) {
				const message = describeError(error);
				account.lastError = message;
				reports.push({
					id: account.id,
					name: account.name || account.url,
					calendars: 0,
					events: 0,
					error: message,
				});
			}
		}

		this.events = collected;
		this.lastSyncAt = Date.now();
		await this.host.saveSettings();
		await writeCache(this.host.app, this.events);
		this.host.onEventsChanged();
		this.syncing = false;

		return { events: collected.length, accounts: reports, at: this.lastSyncAt };
	}

	/**
	 * Connect to one account and list its calendars.
	 *
	 * Used by the settings tab to check a server before the user commits to
	 * it. Throws when the server cannot be reached.
	 */
	async discoverCalendars(account: CalDavAccount): Promise<CalDavCalendarInfo[]> {
		const client = await this.clientFor(account);
		const calendars = await client.listCalendars();
		this.mergeCalendars(account, calendars);
		return calendars;
	}

	/** A client for an account, with its password resolved. */
	private async clientFor(account: CalDavAccount): Promise<CalDavClientLike> {
		const password = await this.host.resolvePassword(account);
		return this.createClient({ ...account, password });
	}

	/**
	 * Merge the calendars found on the server into the account.
	 *
	 * A calendar that is already known keeps its selection; a new one is
	 * selected automatically as long as the user has not picked anything yet.
	 */
	private mergeCalendars(account: CalDavAccount, found: CalDavCalendarInfo[]): void {
		const known = account.calendars ?? [];
		// A calendar that is already known keeps its selection. A calendar
		// seen for the first time is only ticked when the user has not made
		// a choice yet — otherwise new collections would sneak in.
		const userHasChosen = known.length > 0;
		const merged = found.map((calendar) => {
			const previous = known.find((item) => item.url === calendar.url);
			return {
				url: calendar.url,
				name: calendar.name,
				color: calendar.color,
				selected: previous ? previous.selected : !userHasChosen,
			};
		});
		account.calendars = merged;
	}
}

/** Turn whatever the network threw into a sentence a user can act on. */
export function describeError(error: unknown): string {
	if (error instanceof Error) {
		if (error.name === 'TimeoutError') return '请求超时 / request timed out';
		return error.message || error.name;
	}
	if (typeof error === 'string') return error;
	return String(error);
}
