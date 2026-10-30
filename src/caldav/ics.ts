/**
 * ICS → `CalendarEvent`.
 *
 * CalDAV servers hand out raw iCalendar text. This module turns that text
 * into the same event shape the vault sources produce, so the calendar, the
 * agenda and the exporters never need to know where an event came from.
 *
 * The parsing itself is done by `ical.js` — it knows about VTIMEZONE
 * definitions, line folding, escaping and recurrence rules, which is a lot of
 * specification to get right by hand.
 */

import ICAL from 'ical.js';
import type { CalendarEvent } from '../core/types';

export interface IcsParseContext {
	/** Id of the account the event belongs to; part of the event id. */
	accountId: string;
	/** Calendar collection name shown in the agenda. */
	calendarName: string;
	/** Colour of the calendar, if the server provided one. */
	color?: string;
	/**
	 * Only occurrences inside this window are kept.
	 *
	 * Recurring events are expanded, so this also bounds the work: an event
	 * that repeats every minute for a decade cannot stall the calendar.
	 */
	range?: { start: Date; end: Date };
	/** Safety cap on the occurrences expanded from a single event. */
	maxOccurrences?: number;
	/** Title used when the event has no summary. */
	fallbackTitle?: string;
}

const DEFAULT_MAX_OCCURRENCES = 400;

interface Occurrence {
	start: Date;
	end?: Date;
	allDay: boolean;
	/** Identifies the occurrence of a recurring event. */
	key: string;
}

/**
 * Parse one iCalendar document.
 *
 * Returns an empty array for input that cannot be parsed — a single broken
 * object must never take the whole calendar down.
 */
export function parseIcs(ics: string, context: IcsParseContext): CalendarEvent[] {
	const max = context.maxOccurrences ?? DEFAULT_MAX_OCCURRENCES;
	let root: ICAL.Component;
	try {
		root = new ICAL.Component(ICAL.parse(ics));
	} catch {
		return [];
	}
	if (root.name !== 'vcalendar') return [];

	let components: ICAL.Component[];
	try {
		components = root.getAllSubcomponents('vevent');
	} catch {
		return [];
	}
	const events: CalendarEvent[] = [];

	// Overrides ("this instance was moved") are indexed first so that the
	// master event can skip the occurrence they replace.
	const overrides = new Map<string, Map<string, CalendarEvent>>();
	for (const component of components) {
		const recurrenceId = component.getFirstPropertyValue('recurrence-id');
		if (!recurrenceId) continue;
		const event = new ICAL.Event(component);
		const occurrence = occurrenceOf(event, component);
		if (!occurrence) continue;
		const uid = event.uid || '';
		const bucket = overrides.get(uid) ?? new Map<string, CalendarEvent>();
		bucket.set(occurrence.key, buildEvent(event, occurrence, context, occurrence.key));
		overrides.set(uid, bucket);
	}

	for (const component of components) {
		if (component.getFirstPropertyValue('recurrence-id')) continue;
		const event = new ICAL.Event(component);
		const uid = event.uid || '';
		const bucket = overrides.get(uid);

		if (isRecurring(event)) {
			for (const occurrence of expand(event, component, context, max)) {
				if (bucket?.has(occurrence.key)) continue;
				events.push(buildEvent(event, occurrence, context, occurrence.key));
			}
			continue;
		}

		const occurrence = occurrenceOf(event, component);
		if (!occurrence) continue;
		if (bucket?.has(occurrence.key)) continue;
		events.push(buildEvent(event, occurrence, context, occurrence.key));
	}

	for (const bucket of overrides.values()) {
		for (const event of bucket.values()) events.push(event);
	}

	return events;
}

/** Read the start/end of a single (non-expanded) event. */
function occurrenceOf(event: ICAL.Event, component: ICAL.Component): Occurrence | null {
	if (isCancelled(component)) return null;
	let start: Date;
	try {
		start = event.startDate.toJSDate();
	} catch {
		return null;
	}
	if (Number.isNaN(start.getTime())) return null;

	const allDay = event.startDate.isDate === true;
	let end: Date | undefined;
	try {
		const raw = event.endDate;
		if (raw) {
			const candidate = raw.toJSDate();
			if (!Number.isNaN(candidate.getTime()) && candidate.getTime() > start.getTime()) {
				end = allDay ? inclusiveAllDayEnd(start, candidate) : candidate;
			}
		}
	} catch {
		end = undefined;
	}

	return {
		start,
		end,
		allDay,
		key: occurrenceKey(event, component),
	};
}

/**
 * RFC 5545 `DTEND;VALUE=DATE` is exclusive (a 1-day event on Oct 30 has
 * DTEND Oct 31). Convert it to an inclusive end date, or `undefined` when the
 * event covers a single day.
 */
function inclusiveAllDayEnd(start: Date, exclusiveEnd: Date): Date | undefined {
	const lastDay = new Date(
		exclusiveEnd.getFullYear(),
		exclusiveEnd.getMonth(),
		exclusiveEnd.getDate() - 1,
	);
	const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
	return lastDay.getTime() > startDay.getTime() ? lastDay : undefined;
}

/** Expand a recurring event into the occurrences that fall into the range. */
function expand(
	event: ICAL.Event,
	component: ICAL.Component,
	context: IcsParseContext,
	max: number,
): Occurrence[] {
	const results: Occurrence[] = [];
	const duration = durationOf(event);
	let iterator: ICAL.RecurExpansion;
	try {
		iterator = new ICAL.RecurExpansion({ component, dtstart: event.startDate });
	} catch {
		return results;
	}

	const range = context.range;
	let guard = 0;
	let next: ICAL.Time | null = null;
	while (guard < max) {
		guard++;
		try {
			next = iterator.next();
		} catch {
			break;
		}
		if (!next) break;

		const start = next.toJSDate();
		if (range && start.getTime() > range.end.getTime()) break;
		if (range && start.getTime() < range.start.getTime()) continue;

		const rawEnd = new Date(start.getTime() + duration);
		const allDay = event.startDate.isDate === true;
		const end = allDay ? inclusiveAllDayEnd(start, rawEnd) : rawEnd;
		results.push({
			start,
			end,
			allDay,
			key: next.toString(),
		});
	}
	return results;
}

/** Length of an event in milliseconds, used to shift recurring occurrences. */
function durationOf(event: ICAL.Event): number {
	try {
		const end = event.endDate;
		const start = event.startDate;
		if (end && start) {
			const diff = end.toJSDate().getTime() - start.toJSDate().getTime();
			if (diff > 0) return diff;
		}
	} catch {
		/* fall through to the default */
	}
	return event.startDate.isDate === true ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
}

/** A stable key for one occurrence of an event. */
function occurrenceKey(event: ICAL.Event, component: ICAL.Component): string {
	const recurrenceId = component.getFirstPropertyValue('recurrence-id');
	if (recurrenceId) return String(recurrenceId.toString());
	return String(event.startDate.toString());
}

function isRecurring(event: ICAL.Event): boolean {
	try {
		return Boolean(event.isRecurring());
	} catch {
		return false;
	}
}

function isCancelled(component: ICAL.Component): boolean {
	const status = component.getFirstPropertyValue('status');
	return String(status ?? '').toUpperCase() === 'CANCELLED';
}

function buildEvent(
	event: ICAL.Event,
	occurrence: Occurrence,
	context: IcsParseContext,
	key: string,
): CalendarEvent {
	const title = (event.summary ?? '').trim() || context.fallbackTitle || 'Untitled';
	const description = (event.description ?? '').trim();
	const location = (event.location ?? '').trim();
	const status = component_status(event);

	return {
		id: `caldav:${context.accountId}:${event.uid || 'unknown'}:${key}`,
		source: 'caldav',
		title,
		start: occurrence.start,
		end: occurrence.end,
		allDay: occurrence.allDay,
		calendar: context.calendarName,
		color: context.color,
		meta: {
			uid: event.uid ?? '',
			location,
			description,
			status,
			allDay: occurrence.allDay,
		},
	};
}

function component_status(event: ICAL.Event): string {
	try {
		return String(event.component.getFirstPropertyValue('status') ?? '').toUpperCase();
	} catch {
		return '';
	}
}
