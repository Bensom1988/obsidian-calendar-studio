import { describe, expect, it } from 'vitest';
import en from '../src/lang/locale/en';
import zhCN from '../src/lang/locale/zh-CN';
import { interpolate, translate } from '../src/i18n';

describe('i18n', () => {
	it('keeps the two locales in sync', () => {
		expect(Object.keys(zhCN).sort()).toEqual(Object.keys(en).sort());
	});

	it('has no empty strings', () => {
		for (const [key, value] of Object.entries(en)) {
			expect(value.trim().length, key).toBeGreaterThan(0);
		}
		for (const [key, value] of Object.entries(zhCN)) {
			expect(value.trim().length, key).toBeGreaterThan(0);
		}
	});

	it('interpolates variables', () => {
		expect(interpolate('{{count}} events', { count: 3 })).toBe('3 events');
		expect(interpolate('{{a}}/{{b}}', { a: 'x', b: 'y' })).toBe('x/y');
	});

	it('keeps unknown placeholders untouched', () => {
		expect(interpolate('{{missing}}', { other: 1 })).toBe('{{missing}}');
	});

	it('falls back to English, then to the key itself', () => {
		expect(translate('zh-CN', 'settings.localeDesc')).toContain('BCP-47');
		expect(translate('en', 'a.key.that.does.not.exist')).toBe(
			'a.key.that.does.not.exist',
		);
	});

	it('returns different strings per language', () => {
		expect(translate('en', 'view.today')).not.toBe(translate('zh-CN', 'view.today'));
	});
});
