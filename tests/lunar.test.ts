import { describe, expect, it } from 'vitest';
import { getLunarInfo } from '../src/core/lunar';

describe('getLunarInfo', () => {
	it('returns lunar month and day and shows the month name on 初一', () => {
		// 2026-10-10 is Lunar 九月初一.
		const firstDay = getLunarInfo(new Date(2026, 9, 10));
		expect(firstDay.month).toBe('九');
		expect(firstDay.day).toBe('初一');
		expect(firstDay.label).toBe('九月初一');
		expect(firstDay.shortLabel).toBe('九月');

		const regularDay = getLunarInfo(new Date(2026, 9, 30));
		expect(regularDay.month).toBe('九');
		expect(regularDay.day).toBe('廿一');
		expect(regularDay.shortLabel).toBe('廿一');
	});

	it('detects solar terms (节气)', () => {
		// 2026-10-23 is 霜降.
		const info = getLunarInfo(new Date(2026, 9, 23));
		expect(info.jieQi).toBe('霜降');
		expect(info.shortLabel).toBe('霜降');
	});

	it('detects statutory holidays (休) and makeup workdays (班)', () => {
		const nationalDay = getLunarInfo(new Date(2026, 9, 1));
		expect(nationalDay.holiday).toContain('国庆');
		expect(nationalDay.isWorkday).toBe(false);

		const makeupWorkday = getLunarInfo(new Date(2026, 9, 10));
		expect(makeupWorkday.isWorkday).toBe(true);
	});
});
