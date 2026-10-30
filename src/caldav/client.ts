/**
 * A thin wrapper around the `tsdav` CalDAV client.
 *
 * Everything the plugin needs from a CalDAV server is behind two methods:
 * list the calendars, fetch the events of one calendar for a time window.
 * Keeping the surface this small makes the network layer easy to fake in
 * tests and keeps `tsdav` out of the rest of the codebase.
 */

import { createDAVClient } from 'tsdav';
import type { CalDavAccount } from '../core/types';

export interface CalDavCalendarInfo {
	/** Collection URL of the calendar. */
	url: string;
	/** Name shown in the settings and the agenda. */
	name: string;
	/** `#rrggbb` when the server provided one. */
	color?: string;
	/** The server marked the calendar read-only. */
	readOnly?: boolean;
}

export interface CalDavClientLike {
	listCalendars(): Promise<CalDavCalendarInfo[]>;
	/** Raw iCalendar documents of one calendar inside the window. */
	fetchEvents(
		calendarUrl: string,
		range: { start: Date; end: Date },
	): Promise<string[]>;
}

/** How long a single request may take before it is given up on. */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Create a client for one account.
 *
 * The caller decides what to do with failures: this layer only rejects.
 */
export function createCalDavClient(account: CalDavAccount): CalDavClientLike {
	// `createDAVClient` is asynchronous: it performs service discovery.
	const clientPromise = createDAVClient({
		serverUrl: account.url,
		credentials: {
			username: account.username,
			password: account.password,
		},
		authMethod: account.authMethod === 'digest' ? 'Digest' : 'Basic',
		fetchOptions: { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
	});

	return {
		async listCalendars(): Promise<CalDavCalendarInfo[]> {
			const client = await clientPromise;
			const calendars = await client.fetchCalendars();
			return calendars
				.filter((calendar) => !calendar.components || calendar.components.includes('calendar'))
				.map((calendar) => ({
					url: calendar.url,
					name: displayNameOf(calendar.displayName) || calendar.url,
					color: normalizeColor(calendar.calendarColor),
					readOnly: isReadOnly(calendar),
				}));
		},

		async fetchEvents(
			calendarUrl: string,
			range: { start: Date; end: Date },
		): Promise<string[]> {
			const client = await clientPromise;
			const objects = await client.fetchCalendarObjects({
				calendar: { url: calendarUrl },
				timeRange: {
					start: range.start.toISOString(),
					end: range.end.toISOString(),
				},
				// Ask the server to expand recurring events; when it does not
				// understand the request it simply returns the master event
				// and the parser expands it locally.
				expand: true,
			});
			return objects
				.map((object) => (typeof object.data === 'string' ? object.data : ''))
				.filter((data) => data.trim().length > 0);
		},
	};
}

/**
 * The display name of a calendar.
 *
 * Depending on the server it arrives as plain text or as parsed XML.
 */
function displayNameOf(value: unknown): string {
	if (typeof value === 'string') return value.trim();
	if (value && typeof value === 'object') {
		const record = value as Record<string, unknown>;
		const cdata = record._cdata ?? record._text;
		if (typeof cdata === 'string') return cdata.trim();
		for (const nested of Object.values(record)) {
			const found = displayNameOf(nested);
			if (found) return found;
		}
	}
	return '';
}

/** CalDAV colours look like `#rrggbb` or `#rrggbbaa`. */
function normalizeColor(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	if (!trimmed.startsWith('#')) return undefined;
	const hex = trimmed.slice(1, 7);
	if (hex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(hex)) return undefined;
	return `#${hex.toLowerCase()}`;
}

/** Whether the server flagged the collection as read-only. */
function isReadOnly(calendar: { projectedProps?: Record<string, unknown> }): boolean {
	const props = calendar.projectedProps ?? {};
	for (const key of Object.keys(props)) {
		if (key.toLowerCase().includes('readonly')) {
			const value = props[key];
			if (value === true || value === 'true' || value === '1') return true;
		}
	}
	return false;
}
