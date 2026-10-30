/**
 * Offline cache for CalDAV events.
 *
 * The cache lives next to the plugin's settings inside the vault's config
 * folder, so it is never part of the user's notes. It lets the calendar show
 * the last known schedule when the server cannot be reached — a laptop on a
 * train still shows today's meetings.
 */

import type { App } from 'obsidian';
import type { CalendarEvent } from '../core/types';

const CACHE_VERSION = 1;

/** Where the cache is written inside the vault's config folder. */
export function cachePath(app: App): string {
	return `${app.vault.configDir}/plugins/calendar-studio/caldav-cache.json`;
}

interface StoredEvent extends Omit<CalendarEvent, 'start' | 'end'> {
	start: string;
	end?: string;
}

/**
 * Read the cached events.
 *
 * A missing or broken cache is not an error: it simply means there is
 * nothing to show yet.
 */
export async function readCache(app: App): Promise<CalendarEvent[]> {
	try {
		const path = cachePath(app);
		if (!(await app.vault.adapter.exists(path))) return [];
		const raw = await app.vault.adapter.read(path);
		if (!raw.trim()) return [];
		const parsed = JSON.parse(raw) as { version?: number; events?: StoredEvent[] };
		if (!parsed || parsed.version !== CACHE_VERSION || !Array.isArray(parsed.events)) return [];

		const events: CalendarEvent[] = [];
		for (const stored of parsed.events) {
			const start = new Date(stored.start);
			if (Number.isNaN(start.getTime())) continue;
			const end = stored.end ? new Date(stored.end) : undefined;
			events.push({
				...stored,
				start,
				end: end && !Number.isNaN(end.getTime()) ? end : undefined,
			});
		}
		return events;
	} catch {
		return [];
	}
}

/** Write the cache; failures are ignored — the cache is an optimisation. */
export async function writeCache(app: App, events: CalendarEvent[]): Promise<void> {
	try {
		const stored: StoredEvent[] = events.map((event) => ({
			...event,
			start: event.start.toISOString(),
			end: event.end ? event.end.toISOString() : undefined,
		}));
		const payload = JSON.stringify({ version: CACHE_VERSION, savedAt: Date.now(), events: stored });
		await app.vault.adapter.write(cachePath(app), payload);
	} catch {
		/* the cache is best-effort */
	}
}
