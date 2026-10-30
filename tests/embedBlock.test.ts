import { describe, expect, it } from 'vitest';
import { embedRange, parseEmbedOptions, selectEvents } from '../src/ui/embedBlock';
import type { CalendarEvent } from '../src/core/types';

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
	return {
		id: 'tasks:todo.md:due:2026-10-30',
		source: 'tasks',
		title: '提交报告',
		start: new Date(2026, 9, 30, 10, 0),
		allDay: false,
		...overrides,
	};
}

describe('parseEmbedOptions', () => {
	it('returns defaults for an empty block', () => {
		expect(parseEmbedOptions('')).toEqual({
			type: 'agenda',
			date: '',
			days: 7,
			limit: 20,
			calendar: '',
			source: '',
		});
	});

	it('parses known options and clamps invalid numbers', () => {
		const opts = parseEmbedOptions(`
type: month
date: 2026-11
days: 0
limit: -5
calendar: 工作
source: caldav
unknown: ignored
`);
		expect(opts).toEqual({
			type: 'month',
			date: '2026-11',
			days: 1,
			limit: 1,
			calendar: '工作',
			source: 'caldav',
		});
	});
});

describe('embedRange', () => {
	const today = new Date(2026, 9, 30, 14, 20);

	it('spans the configured number of days for agenda', () => {
		const opts = parseEmbedOptions('days: 3');
		const range = embedRange(opts, today);
		expect(range.start).toEqual(new Date(2026, 9, 30));
		expect(range.end).toEqual(new Date(2026, 10, 2));
	});

	it('spans the whole month for month mode', () => {
		const opts = parseEmbedOptions('type: month\ndate: 2026-10-15');
		const range = embedRange(opts, today);
		expect(range.start).toEqual(new Date(2026, 9, 1));
		expect(range.end).toEqual(new Date(2026, 10, 1));
	});

	it('accepts a YYYY-MM date string', () => {
		const opts = parseEmbedOptions('type: month\ndate: 2026-11');
		const range = embedRange(opts, today);
		expect(range.start).toEqual(new Date(2026, 10, 1));
		expect(range.end).toEqual(new Date(2026, 11, 1));
	});
});

describe('selectEvents', () => {
	it('filters by range, calendar, source, and sorts by start time', () => {
		const list: CalendarEvent[] = [
			event({
				id: '1',
				title: '下午评审',
				start: new Date(2026, 9, 30, 15, 0),
				calendar: '工作',
				source: 'caldav',
			}),
			event({
				id: '2',
				title: '上午站会',
				start: new Date(2026, 9, 30, 9, 30),
				calendar: '工作',
				source: 'caldav',
			}),
			event({
				id: '3',
				title: '个人提醒',
				start: new Date(2026, 9, 30, 11, 0),
				calendar: '私人',
				source: 'caldav',
			}),
			event({
				id: '4',
				title: '任务项',
				start: new Date(2026, 9, 30, 8, 0),
				calendar: '工作',
				source: 'tasks',
			}),
		];
		const opts = parseEmbedOptions('calendar: 工作\nsource: caldav\nlimit: 5');
		const range = {
			start: new Date(2026, 9, 30),
			end: new Date(2026, 9, 31),
		};
		const chosen = selectEvents(list, range, opts);
		expect(chosen.map((e) => e.title)).toEqual(['上午站会', '下午评审']);
	});
});
