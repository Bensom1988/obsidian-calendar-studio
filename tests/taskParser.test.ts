import { describe, expect, it } from 'vitest';
import {
	cleanText,
	formatTaskLine,
	parseIsoDate,
	parseTaskLine,
	taskDates,
} from '../src/core/taskParser';

describe('parseTaskLine', () => {
	it('reads a due date from the Tasks emoji', () => {
		const task = parseTaskLine('- [ ] 写周报 📅 2026-10-30');
		expect(task).not.toBeNull();
		expect(task?.due).toEqual(new Date(2026, 9, 30));
		expect(task?.text).toBe('写周报');
	});

	it('reads an inline field', () => {
		const task = parseTaskLine('- [ ] Ship release [due:: 2026-11-02]');
		expect(task?.due).toEqual(new Date(2026, 10, 2));
		expect(task?.text).toBe('Ship release');
	});

	it('reads start and due as two separate dates', () => {
		const task = parseTaskLine('- [ ] 写周报 🛫 2026-10-26 📅 2026-10-30');
		expect(task?.start).toEqual(new Date(2026, 9, 26));
		expect(task?.due).toEqual(new Date(2026, 9, 30));
		const dates = taskDates(task!);
		expect(dates.map((entry) => entry.field)).toEqual(['start', 'due']);
	});

	it('ignores lines that are not tasks', () => {
		expect(parseTaskLine('普通的一行文字')).toBeNull();
		expect(parseTaskLine('- 没有复选框')).toBeNull();
	});

	it('detects the checkbox state', () => {
		expect(parseTaskLine('- [x] 做完了')?.status).toBe('done');
		expect(parseTaskLine('- [>] 正在做')?.status).toBe('in-progress');
		expect(parseTaskLine('- [-] 放弃了')?.status).toBe('cancelled');
		expect(parseTaskLine('- [ ] 待办')?.status).toBe('todo');
	});

	it('keeps tags that are not dates', () => {
		const task = parseTaskLine('- [ ] 写周报 #工作 📅 2026-10-30');
		expect(task?.text).toBe('写周报 #工作');
	});

	it('accepts a date without a space after the emoji', () => {
		expect(parseTaskLine('- [ ] 写周报 📅2026-10-30')?.due).toEqual(new Date(2026, 9, 30));
	});
});

describe('cleanText', () => {
	it('removes the global filter', () => {
		expect(cleanText('写周报 #task', '#task')).toBe('写周报');
	});

	it('keeps the text when there is no filter', () => {
		expect(cleanText('写周报', '')).toBe('写周报');
	});
});

describe('parseIsoDate', () => {
	it('parses a plain date at local midnight', () => {
		const date = parseIsoDate('2026-10-30');
		expect(date?.getFullYear()).toBe(2026);
		expect(date?.getMonth()).toBe(9);
		expect(date?.getDate()).toBe(30);
		expect(date?.getHours()).toBe(0);
	});

	it('rejects anything else', () => {
		expect(parseIsoDate('2026/10/30')).toBeNull();
		expect(parseIsoDate('not a date')).toBeNull();
	});
});

describe('formatTaskLine', () => {
	it('writes a checkbox with a due date and the filter', () => {
		expect(
			formatTaskLine('写周报', { due: new Date(2026, 9, 30), globalFilter: '#task' }),
		).toBe('- [ ] 写周报 📅 2026-10-30 #task');
	});

	it('marks a finished task', () => {
		expect(formatTaskLine('写周报', { done: true })).toBe('- [x] 写周报');
	});
});
