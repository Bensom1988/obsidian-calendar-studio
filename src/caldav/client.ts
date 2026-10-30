/**
 * A thin wrapper around the `tsdav` CalDAV client.
 *
 * Everything the plugin needs from a CalDAV server is behind two methods:
 * list the calendars of an account, fetch the documents of one collection.
 * Keeping the surface this small makes the network layer easy to fake in
 * tests and keeps `tsdav` out of the rest of the codebase.
 *
 * The client talks to the collections directly. A full service discovery —
 * the dance over principal and home set that `tsdav` does first — is not
 * needed for that and many servers do not implement it the way the library
 * expects, so it is only used as a fallback.
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
	/** The collections of the account, found on the server. */
	listCalendars(): Promise<CalDavCalendarInfo[]>;
	/** Raw iCalendar documents of one collection. */
	fetchEvents(
		calendarUrl: string,
		range: { start: Date; end: Date },
	): Promise<string[]>;
}

/** How long a single request may take before it is given up on. */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Create a client for one account.
 *
 * The caller decides what to do with failures: this layer only rejects.
 *
 * `fetchImpl` exists because Obsidian needs its own request function: the
 * one of the browser is stopped by the cross origin rules.
 */
export function createCalDavClient(
	account: CalDavAccount,
	fetchImpl: typeof fetch = globalThis.fetch,
): CalDavClientLike {
	const serverUrl = account.url;
	const credentials = {
		username: account.username,
		password: account.password,
	};
	const authMethod = account.authMethod === 'digest' ? 'Digest' : 'Basic';

	let clientPromise: Promise<Awaited<ReturnType<typeof createDAVClient>>> | undefined;
	/** One client per account; the request itself carries the time limit. */
	async function getClient(): Promise<Awaited<ReturnType<typeof createDAVClient>>> {
		clientPromise ??= createDAVClient({
			serverUrl,
			credentials,
			authMethod,
			fetch: fetchImpl,
		});
		return clientPromise;
	}

	/** A fresh time limit per request: a used up signal would kill the rest. */
	function freshOptions(): { signal: AbortSignal } {
		return { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) };
	}

	return {
		async listCalendars(): Promise<CalDavCalendarInfo[]> {
			const client = await getClient();
			const known = account.calendars ?? [];

			// The collections that are already known are checked first: a
			// server that answers for them is all the plugin needs.
			if (known.length > 0) {
				const alive: CalDavCalendarInfo[] = [];
				for (const calendar of known) {
					try {
						const responses = await client.propfind({
							url: calendar.url,
							props: {
								'd:displayname': {},
								'c:calendar-color': {},
								'd:getctag': {},
							},
							depth: '0',
							fetchOptions: freshOptions(),
						});
						const response = responses[0];
						if (!response || !response.ok) continue;
						alive.push({
							url: calendar.url,
							name:
								displayNameOf(response.props?.displayName) ||
								calendar.name ||
								calendar.url,
							color: normalizeColor(response.props?.calendarColor) ?? calendar.color,
							readOnly: calendar.readOnly,
						});
					} catch {
						// One collection that does not answer does not stop
						// the others.
					}
				}
				if (alive.length > 0) return alive;
			}

			// No collection is known yet: look for them next to the ones
			// that are known, and if that fails ask the server where they
			// live.
			for (const parent of parentCandidates(account)) {
				try {
					const responses = await client.propfind({
						url: parent,
						props: {
							'd:resourcetype': {},
							'd:displayname': {},
							'c:calendar-color': {},
						},
						depth: '1',
						fetchOptions: freshOptions(),
					});
					const calendars = responses
						.filter(isCalendarCollection)
						.map((response) => ({
							url: absoluteUrl(response.href, parent),
							name: displayNameOf(response.props?.displayName),
							color: normalizeColor(response.props?.calendarColor),
						}))
						.filter((calendar) => Boolean(calendar.name || calendar.url));
					if (calendars.length > 0) return calendars;
				} catch {
					// Try the next candidate.
				}
			}

			return discoverWithService(client, serverUrl, credentials);
		},

		async fetchEvents(
			calendarUrl: string,
			range: { start: Date; end: Date },
		): Promise<string[]> {
			const client = await getClient();
			const objects = await client.fetchCalendarObjects({
				calendar: { url: calendarUrl },
				// One request per collection instead of a second one per
				// event — the server sends the documents with the answer.
				useMultiGet: false,
				fetchOptions: freshOptions(),
			});
			return objects
				.map((object) => (typeof object.data === 'string' ? object.data : ''))
				.filter((data) => data.trim().length > 0);
		},
	};
}

/**
 * The service discovery of `tsdav` as a last resort.
 *
 * It asks the server for the principal and the home set and reads the
 * collections from there. Servers that do not implement this fail — the
 * error is passed on so the settings can show it.
 */
async function discoverWithService(
	client: Awaited<ReturnType<typeof createDAVClient>>,
	serverUrl: string,
	credentials: { username: string; password: string },
): Promise<CalDavCalendarInfo[]> {
	const account = await client.createAccount({
		account: {
			serverUrl,
			credentials,
			accountType: 'caldav',
		},
		loadCollections: true,
	});
	const calendars = account.calendars ?? [];
	return calendars
		.filter((calendar) => !calendar.components || calendar.components.includes('calendar'))
		.map((calendar) => ({
			url: calendar.url,
			name: displayNameOf(calendar.displayName) || calendar.url,
			color: normalizeColor(calendar.calendarColor),
		}));
}

/**
 * The directories that may hold the calendars of an account.
 *
 * They are derived from the addresses of the collections that are already
 * known: a collection like `…/dav/user/primary/` sits next to the others
 * in `…/dav/user/`.
 */
export function parentCandidates(account: CalDavAccount): string[] {
	const parents: string[] = [];
	const push = (value: string | undefined): void => {
		if (!value) return;
		const normalized = value.endsWith('/') ? value : `${value}/`;
		if (!parents.includes(normalized)) parents.push(normalized);
	};

	for (const calendar of account.calendars ?? []) {
		let url: URL;
		try {
			url = new URL(calendar.url);
		} catch {
			continue;
		}
		const segments = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
		for (const drop of [1, 2]) {
			if (segments.length > drop) {
				push(`${url.origin}/${segments.slice(0, segments.length - drop).join('/')}/`);
			}
		}
	}
	push(account.rootUrl);
	push(account.url);
	return parents;
}

/** Whether a PROPFIND answer describes a calendar collection. */
function isCalendarCollection(response: { props?: Record<string, any> }): boolean {
	const type = response.props?.resourcetype;
	if (!type) return false;
	if (Array.isArray(type)) return type.includes('calendar');
	if (typeof type === 'string') return type.includes('calendar');
	if (typeof type === 'object') {
		return Object.keys(type).some((key) => key.toLowerCase() === 'calendar');
	}
	return false;
}

/** Turn a relative href into an absolute address. */
function absoluteUrl(href: string | undefined, base: string): string {
	if (!href) return base;
	try {
		return new URL(href, base).href;
	} catch {
		return href;
	}
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
