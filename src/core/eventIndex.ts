import type { CalendarEvent, EventSource } from './types';
import { addDays, startOfDay, toDateKey } from './dateUtils';

/**
 * In-memory index of every known event, grouped by local date key.
 *
 * The vault can hold tens of thousands of notes, so the index is rebuilt
 * lazily and coalesced: sources are re-collected on a debounce whenever the
 * vault changes, never synchronously per keystroke.
 */
export class EventIndex {
	private byDay = new Map<string, CalendarEvent[]>();
	private all: CalendarEvent[] = [];
	private sources: EventSource[] = [];
	private listeners = new Set<() => void>();
	private timer: number | null = null;
	/** Bumped on every rebuild; stale results are dropped. */
	private generation = 0;

	setSources(sources: EventSource[]): void {
		this.sources = sources;
		void this.rebuild();
	}

	/**
	 * Collect every source and swap the index in one go.
	 *
	 * Sources may be asynchronous (reading files, fetching CalDAV). Only the
	 * newest run is allowed to publish its result, so a slow source cannot
	 * overwrite fresher data.
	 */
	async rebuild(): Promise<void> {
		const generation = ++this.generation;
		const collected: CalendarEvent[] = [];

		for (const source of this.sources) {
			try {
				const events = await source.collect();
				if (generation !== this.generation) return;
				collected.push(...events);
			} catch (error) {
				console.error(`[calendar-studio] source "${source.id}" failed:`, error);
			}
		}
		if (generation !== this.generation) return;

		this.all = collected;
		this.byDay.clear();
		for (const event of collected) {
			this.add(event);
		}

		this.notify();
	}

	private add(event: CalendarEvent): void {
		this.all.push(event);

		const start = startOfDay(event.start);
		const end = event.end ? startOfDay(event.end) : start;
		let cursor = start;
		// Guard against pathological ranges (a typo in a date field must not
		// freeze the UI).
		let guard = 0;
		while (cursor <= end && guard < 3660) {
			const key = toDateKey(cursor);
			const bucket = this.byDay.get(key);
			if (bucket) bucket.push(event);
			else this.byDay.set(key, [event]);
			cursor = addDays(cursor, 1);
			guard += 1;
		}
	}

	/** Coalesce rapid vault changes into a single rebuild. */
	scheduleRebuild(delayMs = 500): void {
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => {
			this.timer = null;
			void this.rebuild();
		}, delayMs);
	}

	onChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		for (const listener of this.listeners) {
			try {
				listener();
			} catch (error) {
				console.error('[calendar-studio] index listener failed:', error);
			}
		}
	}

	getAll(): CalendarEvent[] {
		return this.all;
	}

	getEventsOnDateKey(key: string): CalendarEvent[] {
		return this.byDay.get(key) ?? [];
	}

	getEventsOnDate(date: Date): CalendarEvent[] {
		return this.getEventsOnDateKey(toDateKey(date));
	}

	getEventsInRange(from: Date, to: Date): CalendarEvent[] {
		const seen = new Set<string>();
		const events: CalendarEvent[] = [];
		let cursor = startOfDay(from);
		const last = startOfDay(to);
		while (cursor <= last) {
			for (const event of this.getEventsOnDate(cursor)) {
				if (seen.has(event.id)) continue;
				seen.add(event.id);
				events.push(event);
			}
			cursor = addDays(cursor, 1);
		}
		return events;
	}

	/** Distinct days that carry at least one event, within the given range. */
	getDaysWithEvents(from: Date, to: Date): Set<string> {
		const days = new Set<string>();
		let cursor = startOfDay(from);
		const last = startOfDay(to);
		while (cursor <= last) {
			const key = toDateKey(cursor);
			if (this.byDay.has(key)) days.add(key);
			cursor = addDays(cursor, 1);
		}
		return days;
	}
}
