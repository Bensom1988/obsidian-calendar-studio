/**
 * The iCalendar export.
 *
 * The events of the calendar are written as an `.ics` file, so other
 * programs can read them: a phone calendar, a calendar app, a mail client.
 */

import type { CalendarEvent } from '../core/types';

export interface IcsOptions {
	/** Name of the exported calendar. */
	name?: string;
	/** Product that wrote the file. */
	productId?: string;
}

/**
 * Build the text of an `.ics` file.
 *
 * The times are written in UTC — every program understands that and no
 * reader has to know the timezone of the vault.
 */
export function buildIcs(events: CalendarEvent[], options: IcsOptions = {}): string {
	const productId = options.productId ?? '-//Calendar Studio//Obsidian//EN';
	const lines: string[] = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		`PRODID:${productId}`,
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
	];
	if (options.name) lines.push(`X-WR-CALNAME:${escapeText(options.name)}`);

	for (const event of events) {
		lines.push(...eventLines(event));
	}
	lines.push('END:VCALENDAR');
	return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** The lines of one event. */
function eventLines(event: CalendarEvent): string[] {
	const lines: string[] = ['BEGIN:VEVENT'];
	lines.push(`UID:${event.id}`);
	lines.push(`DTSTAMP:${formatUtc(new Date())}`);
	if (event.allDay) {
		lines.push(`DTSTART;VALUE=DATE:${formatDate(event.start)}`);
		const end = event.end ?? addOneDay(event.start);
		lines.push(`DTEND;VALUE=DATE:${formatDate(end)}`);
	} else {
		lines.push(`DTSTART:${formatUtc(event.start)}`);
		lines.push(`DTEND:${formatUtc(event.end ?? event.start)}`);
	}
	lines.push(`SUMMARY:${escapeText(event.title)}`);
	if (event.calendar) lines.push(`CATEGORIES:${escapeText(event.calendar)}`);
	if (event.url) lines.push(`URL:${event.url}`);
	if (event.filePath) lines.push(`X-OBSIDIAN-FILE:${escapeText(event.filePath)}`);
	lines.push('END:VEVENT');
	return lines;
}

/** Escape the characters that mean something in a text value. */
export function escapeText(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r?\n/g, '\\n');
}

/** Fold a long line: 75 octets per line, the rest continues with a space. */
export function foldLine(line: string): string {
	if (line.length <= 73) return line;
	const parts: string[] = [];
	let rest = line;
	while (rest.length > 73) {
		parts.push(rest.slice(0, 73));
		rest = ` ${rest.slice(73)}`;
	}
	parts.push(rest);
	return parts.join('\r\n');
}

/** `20261030T010000Z` */
function formatUtc(date: Date): string {
	return (
		`${date.getUTCFullYear()}` +
		`${pad2(date.getUTCMonth() + 1)}` +
		`${pad2(date.getUTCDate())}` +
		`T${pad2(date.getUTCHours())}` +
		`${pad2(date.getUTCMinutes())}` +
		`${pad2(date.getUTCSeconds())}Z`
	);
}

/** `20261030` */
function formatDate(date: Date): string {
	return (
		`${date.getFullYear()}` +
		`${pad2(date.getMonth() + 1)}` +
		`${pad2(date.getDate())}`
	);
}

function addOneDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

function pad2(value: number): string {
	return value < 10 ? `0${value}` : String(value);
}

/** The name of the exported file, for example `calendar-2026-10.ics`. */
export function icsFileName(prefix: string, date: Date): string {
	const stamp = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
	const safe = prefix.replace(/[\\/:*?"<>|]/g, '-').trim() || 'calendar';
	return `${safe}-${stamp}.ics`;
}
