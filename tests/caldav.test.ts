import { parentCandidates } from '../src/caldav/client';
import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import { parseIcs } from '../src/caldav/ics';
import { CalDavService, type CalDavHost } from '../src/caldav/service';
import type { CalDavClientLike } from '../src/caldav/client';
import type { CalDavAccount, CalDavSettings } from '../src/core/types';

const CONTEXT = {
	accountId: 'acc-1',
	calendarName: '工作',
	color: '#3366cc',
	fallbackTitle: '无标题',
};

function ics(body: string): string {
	return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//calendar-studio//test//EN
${body}
END:VCALENDAR`;
}

const TIMEZONE = `BEGIN:VTIMEZONE
TZID:Asia/Shanghai
BEGIN:STANDARD
TZOFFSETFROM:+0800
TZOFFSETTO:+0800
TZNAME:CST
DTSTART:19700101T000000
END:STANDARD
END:VTIMEZONE`;

describe('parseIcs', () => {
	it('reads a timed event with a time zone', () => {
		const events = parseIcs(
			ics(`${TIMEZONE}
BEGIN:VEVENT
UID:evt-1
DTSTAMP:20261020T010000Z
DTSTART;TZID=Asia/Shanghai:20261030T090000
DTEND;TZID=Asia/Shanghai:20261030T103000
SUMMARY:周会
LOCATION:会议室 A
DESCRIPTION:第一行\\n第二行
END:VEVENT`),
			CONTEXT,
		);

		expect(events).toHaveLength(1);
		const event = events[0];
		expect(event.title).toBe('周会');
		expect(event.source).toBe('caldav');
		expect(event.allDay).toBe(false);
		expect(event.calendar).toBe('工作');
		expect(event.color).toBe('#3366cc');
		expect(event.start.getHours()).toBe(9);
		expect(event.start.getMinutes()).toBe(0);
		expect(event.end!.getHours()).toBe(10);
		expect(event.end!.getMinutes()).toBe(30);
		expect(event.meta?.location).toBe('会议室 A');
		expect(event.meta?.description).toBe('第一行\n第二行');
	});

	it('reads an all-day event', () => {
		const events = parseIcs(
			ics(`BEGIN:VEVENT
UID:evt-2
DTSTAMP:20261020T010000Z
DTSTART;VALUE=DATE:20261031
DTEND;VALUE=DATE:20261101
SUMMARY:全天活动
END:VEVENT`),
			CONTEXT,
		);

		expect(events).toHaveLength(1);
		expect(events[0].allDay).toBe(true);
		expect(events[0].start.getDate()).toBe(31);
		expect(events[0].start.getHours()).toBe(0);
		expect(events[0].end!.getDate()).toBe(1);
	});

	it('expands a recurring event inside the range', () => {
		const events = parseIcs(
			ics(`${TIMEZONE}
BEGIN:VEVENT
UID:evt-3
DTSTAMP:20261020T010000Z
DTSTART;TZID=Asia/Shanghai:20261026T093000
DTEND;TZID=Asia/Shanghai:20261026T103000
SUMMARY:每周例会
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=6
END:VEVENT`),
			{
				...CONTEXT,
				range: { start: new Date(2026, 9, 1), end: new Date(2026, 10, 31, 23, 59) },
			},
		);

		// 2026-10-26, 11-02, 11-09, 11-16, 11-23, 11-30 — six Mondays.
		expect(events).toHaveLength(6);
		expect(events[0].start.getDate()).toBe(26);
		expect(events[1].start.getDate()).toBe(2);
		expect(events[1].start.getMonth()).toBe(10);
		expect(events[0].start.getHours()).toBe(9);
		expect(events[0].end!.getHours()).toBe(10);
	});

	it('drops occurrences outside the range', () => {
		const events = parseIcs(
			ics(`BEGIN:VEVENT
UID:evt-4
DTSTAMP:20261020T010000Z
DTSTART:20260101T090000Z
DTEND:20260101T100000Z
SUMMARY:很久以前
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=5
END:VEVENT`),
			{
				...CONTEXT,
				range: { start: new Date(2026, 9, 1), end: new Date(2026, 9, 31, 23, 59) },
			},
		);
		expect(events).toHaveLength(0);
	});

	it('skips cancelled events', () => {
		const events = parseIcs(
			ics(`BEGIN:VEVENT
UID:evt-5
DTSTAMP:20261020T010000Z
DTSTART:20261030T090000Z
DTEND:20261030T100000Z
SUMMARY:取消的会
STATUS:CANCELLED
END:VEVENT`),
			CONTEXT,
		);
		expect(events).toHaveLength(0);
	});

	it('lets an override replace one occurrence', () => {
		const events = parseIcs(
			ics(`${TIMEZONE}
BEGIN:VEVENT
UID:evt-6
DTSTAMP:20261020T010000Z
DTSTART;TZID=Asia/Shanghai:20261026T093000
DTEND;TZID=Asia/Shanghai:20261026T103000
SUMMARY:每周例会
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=3
END:VEVENT
BEGIN:VEVENT
UID:evt-6
RECURRENCE-ID;TZID=Asia/Shanghai:20261102T093000
DTSTAMP:20261020T010000Z
DTSTART;TZID=Asia/Shanghai:20261102T140000
DTEND;TZID=Asia/Shanghai:20261102T150000
SUMMARY:每周例会（改期）
END:VEVENT`),
			CONTEXT,
		);

		const moved = events.find((event) => event.title.includes('改期'));
		expect(moved).toBeDefined();
		expect(moved!.start.getHours()).toBe(14);
		expect(moved!.start.getDate()).toBe(2);
		// The moved instance must not appear twice.
		expect(events.filter((event) => event.start.getDate() === 2)).toHaveLength(1);
		expect(events).toHaveLength(3);
	});

	it('uses the fallback title when there is no summary', () => {
		const events = parseIcs(
			ics(`BEGIN:VEVENT
UID:evt-7
DTSTAMP:20261020T010000Z
DTSTART:20261030T090000Z
DTEND:20261030T100000Z
END:VEVENT`),
			CONTEXT,
		);
		expect(events[0].title).toBe('无标题');
	});

	it('survives broken input', () => {
		expect(parseIcs('this is not a calendar', CONTEXT)).toEqual([]);
		expect(parseIcs('', CONTEXT)).toEqual([]);
	});
});

/** A fake vault adapter that keeps the cache in memory. */
function fakeApp(): App & { files: Map<string, string> } {
	const files = new Map<string, string>();
	return {
		files,
		vault: {
			configDir: '.obsidian',
			adapter: {
				async exists(path: string) {
					return files.has(path);
				},
				async read(path: string) {
					return files.get(path) ?? '';
				},
				async write(path: string, content: string) {
					files.set(path, content);
				},
			},
		},
	} as unknown as App & { files: Map<string, string> };
}

function fakeHost(app: App, settings: CalDavSettings): CalDavHost & { changed: number } {
	const host = {
		app,
		caldavSettings: settings,
		changed: 0,
		async saveSettings() {
			/* nothing to persist in the test */
		},
		onEventsChanged() {
			host.changed += 1;
		},
		fallbackTitle() {
			return '无标题';
		},
		async resolvePassword(account: CalDavAccount) {
			return account.password;
		},
	};
	return host as unknown as CalDavHost & { changed: number };
}

function account(overrides: Partial<CalDavAccount> = {}): CalDavAccount {
	return {
		id: 'acc-1',
		name: '工作',
		url: 'https://example.com/dav/',
		username: 'me@example.com',
		password: 'secret',
		color: '#3366cc',
		authMethod: 'basic',
		calendars: [],
		...overrides,
	};
}

describe('CalDavService', () => {
	it('collects the events of the selected calendars', async () => {
		const app = fakeApp();
		const settings: CalDavSettings = {
			enabled: true,
			accounts: [
				account({
					calendars: [
						{ url: 'https://example.com/dav/cal/', name: '会议', color: '#112233', selected: true },
						{ url: 'https://example.com/dav/private/', name: '私人', selected: true },
					],
				}),
			],
			autoSyncMinutes: 0,
			rangeMonths: 0,
		};
		const host = fakeHost(app, settings);
		const client: CalDavClientLike = {
			async listCalendars() {
				return [
					{ url: 'https://example.com/dav/cal/', name: '会议', color: '#112233' },
					{ url: 'https://example.com/dav/private/', name: '私人' },
				];
			},
			async fetchEvents(calendarUrl: string) {
				if (calendarUrl !== 'https://example.com/dav/cal/') return [];
				return [
					ics(`BEGIN:VEVENT
UID:e1
DTSTAMP:20261020T010000Z
DTSTART:20261030T090000Z
DTEND:20261030T100000Z
SUMMARY:站会
END:VEVENT`),
				];
			},
		};

		const service = new CalDavService(host, () => client);
		const report = await service.sync({
			start: new Date(2026, 9, 1),
			end: new Date(2026, 9, 31, 23, 59),
		});

		expect(report.events).toBe(1);
		expect(report.accounts[0].error).toBeUndefined();
		expect(service.getEvents()[0].title).toBe('站会');
		expect(service.getEvents()[0].calendar).toBe('会议');
		// The calendars of the account are the ones that are read.
		expect(settings.accounts[0].calendars.map((c) => c.url)).toEqual([
			'https://example.com/dav/cal/',
			'https://example.com/dav/private/',
		]);
		expect(host.changed).toBeGreaterThan(0);
	});

	it('keeps the selection of calendars it already knows', async () => {
		const app = fakeApp();
		const settings: CalDavSettings = {
			enabled: true,
			accounts: [
				account({
					calendars: [{ url: 'https://example.com/dav/cal/', name: '会议', selected: false }],
				}),
			],
			autoSyncMinutes: 0,
			rangeMonths: 0,
		};
		const host = fakeHost(app, settings);
		const client: CalDavClientLike = {
			async listCalendars() {
				return [
					{ url: 'https://example.com/dav/cal/', name: '会议' },
					{ url: 'https://example.com/dav/new/', name: '新日历' },
				];
			},
			async fetchEvents() {
				return [];
			},
		};

		const service = new CalDavService(host, () => client);
		await service.discoverCalendars(settings.accounts[0]);

		const calendars = settings.accounts[0].calendars;
		expect(calendars.find((c) => c.url.endsWith('/cal/'))?.selected).toBe(false);
		expect(calendars.find((c) => c.url.endsWith('/new/'))?.selected).toBe(false);
	});

	it('reports a failing account without losing the others', async () => {
		const app = fakeApp();
		const settings: CalDavSettings = {
			enabled: true,
			accounts: [
				account({
					id: 'bad',
					calendars: [{ url: 'https://example.com/dav/cal/', name: '会议', selected: true }],
				}),
				account({
					id: 'good',
					calendars: [{ url: 'https://example.com/dav/cal/', name: '会议', selected: true }],
				}),
			],
			autoSyncMinutes: 0,
			rangeMonths: 0,
		};
		const host = fakeHost(app, settings);
		let failing = true;
		const client: CalDavClientLike = {
			async listCalendars() {
				throw new Error('401 Unauthorized');
			},
			async fetchEvents() {
				if (failing) {
					failing = false;
					throw new Error('401 Unauthorized');
				}
				return [];
			},
		};

		const service = new CalDavService(host, () => client);
		const report = await service.sync({
			start: new Date(2026, 9, 1),
			end: new Date(2026, 9, 31),
		});

		expect(report.accounts).toHaveLength(2);
		// One failing account does not stop the other one.
		expect(report.accounts[0].error).toContain('401');
		expect(report.accounts[1].error).toBeUndefined();
		expect(settings.accounts[0].lastError).toContain('401');
	});

	it('writes and restores the offline cache', async () => {
		const app = fakeApp();
		const settings: CalDavSettings = {
			enabled: true,
			accounts: [
				account({
					calendars: [{ url: 'https://example.com/dav/cal/', name: '会议', selected: true }],
				}),
			],
			autoSyncMinutes: 0,
			rangeMonths: 0,
		};
		const host = fakeHost(app, settings);
		const client: CalDavClientLike = {
			async listCalendars() {
				return [{ url: 'https://example.com/dav/cal/', name: '会议' }];
			},
			async fetchEvents() {
				return [
					ics(`BEGIN:VEVENT
UID:e1
DTSTAMP:20261020T010000Z
DTSTART:20261030T090000Z
DTEND:20261030T100000Z
SUMMARY:站会
END:VEVENT`),
				];
			},
		};

		const service = new CalDavService(host, () => client);
		await service.sync({ start: new Date(2026, 9, 1), end: new Date(2026, 9, 31) });
		expect(app.files.size).toBe(1);

		const restored = new CalDavService(host, () => client);
		const count = await restored.restoreFromCache();
		expect(count).toBe(1);
		expect(restored.getEvents()[0].title).toBe('站会');
		expect(restored.getEvents()[0].start).toBeInstanceOf(Date);
	});
});

describe('parentCandidates', () => {
	it('derives the DAV root from the calendar addresses', () => {
		const roots = parentCandidates({
			id: 'a',
			name: '钉钉',
			url: 'https://calendar.dingtalk.com/',
			username: 'u',
			password: '',
			color: '#fff',
			authMethod: 'basic',
			calendars: [
				{
					url: 'https://calendar.dingtalk.com/dav/u_rmqleiut/primary/',
					name: '我的日历',
					selected: true,
				},
			],
		});
		expect(roots[0]).toBe('https://calendar.dingtalk.com/dav/u_rmqleiut/');
		expect(roots).toContain('https://calendar.dingtalk.com/dav/');
		expect(roots[roots.length - 1]).toBe('https://calendar.dingtalk.com/');
	});

	it('keeps a root that was found before at the front', () => {
		const roots = parentCandidates({
			id: 'b',
			name: 'iCloud',
			url: 'https://p216-caldav.icloud.com.cn/',
			username: 'u',
			password: '',
			color: '#fff',
			authMethod: 'basic',
			rootUrl: 'https://p216-caldav.icloud.com.cn/16535323514/',
			calendars: [
				{
					url: 'https://p216-caldav.icloud.com.cn/16535323514/calendars/ABC/',
					name: '日历',
					selected: true,
				},
			],
		});
		expect(roots[0]).toBe('https://p216-caldav.icloud.com.cn/16535323514/calendars/');
	});
});
