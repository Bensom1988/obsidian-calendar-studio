import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import {
	AGENDA_END,
	AGENDA_START,
	agendaBlock,
	dailyNotePath,
	eventsToMarkdown,
	upsertBlock,
} from '../src/workflow/dailyNote';
import {
	buildTaskLines,
	tasksBlock,
	upsertTaskBlock,
} from '../src/workflow/taskGenerator';
import { formatDatePattern } from '../src/core/dateUtils';
import { DEFAULT_SETTINGS, type CalendarEvent } from '../src/core/types';

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
	return {
		id: 'test:1',
		source: 'frontmatter',
		title: '写周报',
		start: new Date(2026, 9, 30, 10, 0),
		allDay: false,
		...overrides,
	};
}

describe('formatDatePattern', () => {
	it('fills the common tokens', () => {
		expect(formatDatePattern(new Date(2026, 9, 30), 'YYYY-MM-DD')).toBe('2026-10-30');
		expect(formatDatePattern(new Date(2026, 9, 3), 'YYYY-M-D')).toBe('2026-10-3');
		expect(formatDatePattern(new Date(2026, 9, 30), 'YY')).toBe('26');
	});

	it('leaves unknown tokens alone', () => {
		expect(formatDatePattern(new Date(2026, 9, 30), 'YYYY~QQ')).toBe('2026~QQ');
	});
});

describe('eventsToMarkdown', () => {
	it('lists timed events with their time', () => {
		expect(eventsToMarkdown([event()], 'en-US')).toContain('写周报');
	});

	it('puts all-day events first', () => {
		const allDay = event({ id: 'a', title: '全天', allDay: true, start: new Date(2026, 9, 30) });
		const timed = event({ id: 'b', title: '定时' });
		const lines = eventsToMarkdown([timed, allDay], 'en-US').split('\n');
		expect(lines[0]).toContain('全天');
		expect(lines[1]).toContain('定时');
	});

	it('returns an empty string when there is nothing', () => {
		expect(eventsToMarkdown([], 'en-US')).toBe('');
	});
});

describe('upsertBlock', () => {
	it('replaces an existing block instead of duplicating it', () => {
		const first = upsertBlock('# Note\n', agendaBlock([event({ title: '旧' })], 'en-US'));
		const second = upsertBlock(first, agendaBlock([event({ title: '新' })], 'en-US'));
		expect(second).toContain('新');
		expect(second).not.toContain('旧');
		expect(second.split(AGENDA_START)).toHaveLength(2);
		expect(second).toContain(AGENDA_END);
	});

	it('appends the block when the note has none', () => {
		const content = upsertBlock('# Note\n', agendaBlock([event()], 'en-US'));
		expect(content.startsWith('# Note')).toBe(true);
		expect(content).toContain(AGENDA_START);
	});

	it('keeps what the user wrote', () => {
		const content = upsertBlock('# Note\n\n我的正文\n', agendaBlock([event()], 'en-US'));
		expect(content).toContain('我的正文');
	});
});

describe('upsertTaskBlock', () => {
	it('replaces the task block', () => {
		const first = upsertTaskBlock('', tasksBlock(['- [ ] 旧']));
		const second = upsertTaskBlock(first, tasksBlock(['- [ ] 新']));
		expect(second).toContain('新');
		expect(second).not.toContain('旧');
	});
});

describe('buildTaskLines', () => {
	it('renders the template for every event', () => {
		const lines = buildTaskLines([event()], ['- [ ] {{title}} 📅 {{date}}'], new Date(2026, 9, 30), 'en-US');
		expect(lines).toEqual(['- [ ] 写周报 📅 2026-10-30']);
	});

	it('falls back to a default template', () => {
		const lines = buildTaskLines([event()], [], new Date(2026, 9, 30), 'en-US');
		expect(lines[0]).toContain('📅 2026-10-30');
	});

	it('supports several templates per event', () => {
		const lines = buildTaskLines(
			[event()],
			['- [ ] {{title}}', '- [ ] {{calendar}}: {{title}}'],
			new Date(2026, 9, 30),
			'en-US',
		);
		expect(lines).toHaveLength(2);
	});
});

describe('dailyNotePath', () => {
	const app = { internalPlugins: undefined } as unknown as App;

	it('uses the folder and format from the settings', () => {
		const path = dailyNotePath(app, new Date(2026, 9, 30), {
			...DEFAULT_SETTINGS.workflow,
			useCoreDailyNotes: false,
			dailyNoteFolder: 'Daily',
			dailyNoteFormat: 'YYYY-MM-DD',
		});
		expect(path).toBe('Daily/2026-10-30.md');
	});

	it('falls back to the vault root', () => {
		const path = dailyNotePath(app, new Date(2026, 9, 30), {
			...DEFAULT_SETTINGS.workflow,
			useCoreDailyNotes: false,
			dailyNoteFolder: '',
		});
		expect(path).toBe('2026-10-30.md');
	});

	it('follows Obsidian when the core plugin provides settings', () => {
		const withCore = {
			internalPlugins: {
				getPluginById: () => ({
					instance: {
						getDailyNoteSettings: () => ({ folder: '日记', format: 'YYYY/MM/DD' }),
					},
				}),
			},
		} as unknown as App;
		const path = dailyNotePath(withCore, new Date(2026, 9, 30), DEFAULT_SETTINGS.workflow);
		expect(path).toBe('日记/2026/10/30.md');
	});
});
