import { describe, expect, it } from 'vitest';
import {
	buildMonthGrid,
	parseDateValue,
	startOfWeek,
	toDateKey,
	weekendIndexes,
} from '../src/core/dateUtils';
import { buildPattern, cleanTitle, findDate } from '../src/sources/filename';
import { matchesFolder, normaliseFolder } from '../src/sources/folders';

describe('dateUtils', () => {
	it('formats a local date key', () => {
		expect(toDateKey(new Date(2026, 9, 30))).toBe('2026-10-30');
	});

	it('parses date-only values without a time component', () => {
		const parsed = parseDateValue('2026-10-30');
		expect(parsed?.hasTime).toBe(false);
		expect(toDateKey(parsed!.date)).toBe('2026-10-30');
	});

	it('parses date-time values', () => {
		const parsed = parseDateValue('2026-10-30 14:30');
		expect(parsed?.hasTime).toBe(true);
		expect(parsed?.date.getHours()).toBe(14);
		expect(parsed?.date.getMinutes()).toBe(30);
	});

	it('parses Chinese and slashed date formats', () => {
		expect(toDateKey(parseDateValue('2026年10月30日')!.date)).toBe('2026-10-30');
		expect(toDateKey(parseDateValue('2026/10/30')!.date)).toBe('2026-10-30');
	});

	it('rejects unusable values', () => {
		expect(parseDateValue('not a date')).toBeNull();
		expect(parseDateValue('')).toBeNull();
		expect(parseDateValue(null)).toBeNull();
		expect(parseDateValue({})).toBeNull();
	});

	it('honours the configured first day of the week', () => {
		// 2026-10-30 is a Friday.
		const friday = new Date(2026, 9, 30);
		expect(toDateKey(startOfWeek(friday, 1))).toBe('2026-10-26'); // Monday
		expect(toDateKey(startOfWeek(friday, 0))).toBe('2026-10-25'); // Sunday
	});

	it('builds a stable six-week month grid', () => {
		const grid = buildMonthGrid(new Date(2026, 9, 1), 1);
		expect(grid).toHaveLength(42);
		expect(toDateKey(grid[0])).toBe('2026-09-28');
		expect(toDateKey(grid[41])).toBe('2026-11-08');
	});

	it('computes weekend columns relative to the week start', () => {
		expect(weekendIndexes(1)).toEqual([5, 6]);
		expect(weekendIndexes(0)).toEqual([6, 0]);
	});
});

describe('filename source', () => {
	it('finds a date inside a file name', () => {
		const pattern = buildPattern('YYYY-MM-DD')!;
		const match = findDate('2026-10-30-周会', [pattern]);
		expect(match?.iso).toBe('2026-10-30');
	});

	it('builds the title from what is left over', () => {
		expect(cleanTitle('2026-10-30-周会', '2026-10-30')).toBe('周会');
		expect(cleanTitle('2026-10-30', '2026-10-30')).toBe('2026-10-30');
	});

	it('ignores names without a date', () => {
		const pattern = buildPattern('YYYY-MM-DD')!;
		expect(findDate('周会纪要', [pattern])).toBeNull();
	});

	it('supports alternative separators', () => {
		const pattern = buildPattern('YYYY.MM.DD')!;
		expect(findDate('2026.10.30', [pattern])?.iso).toBe('2026-10-30');
	});
});

describe('folder filters', () => {
	it('normalises user input', () => {
		expect(normaliseFolder('/Folder/Sub/')).toBe('Folder/Sub');
	});

	it('includes everything when no include list is given', () => {
		expect(matchesFolder('a/b/c.md', { include: [], exclude: [] })).toBe(true);
	});

	it('applies include and exclude lists', () => {
		const filter = { include: ['Notes'], exclude: ['Notes/Private'] };
		expect(matchesFolder('Notes/a.md', filter)).toBe(true);
		expect(matchesFolder('Notes/Private/b.md', filter)).toBe(false);
		expect(matchesFolder('Other/c.md', filter)).toBe(false);
	});
});
