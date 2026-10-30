import { describe, expect, it } from 'vitest';
import { buildIcs, escapeText, foldLine, icsFileName } from '../src/export/ics';
import { EventIndex } from '../src/core/eventIndex';
import type { CalendarEvent } from '../src/core/types';

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
	return {
		id: 'frontmatter:note.md:start:2026-10-30',
		source: 'frontmatter',
		title: '站会',
		start: new Date(2026, 9, 30, 9, 0),
		end: new Date(2026, 9, 30, 10, 0),
		allDay: false,
		...overrides,
	};
}

describe('buildIcs', () => {
	it('writes a calendar with the event', () => {
		const ics = buildIcs([event()], { name: '我的日历' });

		expect(ics).toContain('BEGIN:VCALENDAR');
		expect(ics).toContain('VERSION:2.0');
		expect(ics).toContain('X-WR-CALNAME:我的日历');
		expect(ics).toContain('BEGIN:VEVENT');
		expect(ics).toContain('SUMMARY:站会');
		expect(ics).toContain('END:VCALENDAR');
		// 09:00 local time is written as UTC.
		expect(ics).toContain('DTSTART:20261030T010000Z');
		expect(ics).toContain('DTEND:20261030T020000Z');
		// Every line ends with CRLF.
		expect(ics.endsWith('\r\n')).toBe(true);
	});

	it('writes a whole day as a date', () => {
		const ics = buildIcs([
			event({ allDay: true, end: undefined, start: new Date(2026, 9, 30) }),
		]);

		expect(ics).toContain('DTSTART;VALUE=DATE:20261030');
		expect(ics).toContain('DTEND;VALUE=DATE:20261031');
	});

	it('keeps the calendar and the file of the event', () => {
		const ics = buildIcs([
			event({ calendar: '工作', filePath: '笔记/评审.md', url: 'https://example.com' }),
		]);

		expect(ics).toContain('CATEGORIES:工作');
		expect(ics).toContain('X-OBSIDIAN-FILE:笔记/评审.md');
		expect(ics).toContain('URL:https://example.com');
	});
});

describe('escapeText', () => {
	it('escapes the characters that mean something', () => {
		expect(escapeText('a;b,c\\d')).toBe('a\\;b\\,c\\\\d');
		expect(escapeText('one\ntwo')).toBe('one\\ntwo');
	});
});

describe('foldLine', () => {
	it('keeps a short line as it is', () => {
		expect(foldLine('SUMMARY:站会')).toBe('SUMMARY:站会');
	});

	it('folds a long line and continues with a space', () => {
		const folded = foldLine(`SUMMARY:${'x'.repeat(200)}`);

		expect(folded).toContain('\r\n ');
		for (const line of folded.split('\r\n')) {
			expect(line.length).toBeLessThanOrEqual(74);
		}
	});

	it('folds multi-byte Chinese characters within 75 UTF-8 octets per line', () => {
		const folded = foldLine(`SUMMARY:${'中文日历事件标题测试'.repeat(6)}`);
		const enc = new TextEncoder();
		for (const line of folded.split('\r\n')) {
			expect(enc.encode(line).byteLength).toBeLessThanOrEqual(75);
		}
	});
});

describe('EventIndex.rebuild', () => {
	it('indexes events without duplicating or infinite-looping', async () => {
		const index = new EventIndex();
		index.setSources(
			[
				{
					id: 'frontmatter',
					collect: () => [
						event({
							id: 'fm:1',
							start: new Date(2026, 9, 30),
							end: undefined,
							allDay: true,
						}),
					],
				},
			],
			false,
		);
		await index.rebuild();
		expect(index.getAll()).toHaveLength(1);
		expect(index.getEventsOnDate(new Date(2026, 9, 30))).toHaveLength(1);
		expect(index.getEventsOnDate(new Date(2026, 9, 31))).toHaveLength(0);
	});
});

describe('icsFileName', () => {
	it('names the file after the month', () => {
		expect(icsFileName('calendar', new Date(2026, 9, 30))).toBe('calendar-2026-10.ics');
	});

	it('replaces the characters a file name may not hold', () => {
		expect(icsFileName('a/b:c', new Date(2026, 9, 30))).toBe('a-b-c-2026-10.ics');
	});
});
