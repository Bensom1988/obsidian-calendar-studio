import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import { CredentialStore, secretId } from '../src/caldav/credentials';
import {
	fullCalendarSecretId,
	groupFullCalendarSources,
	type FullCalendarSource,
} from '../src/caldav/importFullCalendar';

function appWithSecrets(): App & { secrets: Map<string, string> } {
	const secrets = new Map<string, string>();
	return {
		secrets,
		secretStorage: {
			setSecret(id: string, value: string) {
				secrets.set(id, value);
			},
			getSecret(id: string) {
				return secrets.get(id) ?? null;
			},
			listSecrets() {
				return [...secrets.keys()];
			},
		},
	} as unknown as App & { secrets: Map<string, string> };
}

describe('secretId', () => {
	it('turns account ids into valid secret ids', () => {
		expect(secretId('caldav_1699999999999')).toBe('calendar-studio-caldav-caldav-1699999999999');
		expect(secretId('caldav-1')).toBe('calendar-studio-caldav-caldav-1');
		expect(secretId('')).toBe('calendar-studio-caldav-default');
	});
});

describe('CredentialStore', () => {
	it('keeps the password out of the settings file', () => {
		const app = appWithSecrets();
		const store = new CredentialStore(app);
		expect(store.secure).toBe(true);

		expect(store.set('acc-1', 'hunter2')).toBe(true);
		expect(store.get('acc-1')).toBe('hunter2');
		expect(app.secrets.has('calendar-studio-caldav-acc-1')).toBe(true);

		store.remove('acc-1');
		expect(store.get('acc-1')).toBe('');
	});

	it('reports that secrets are unavailable on old Obsidian versions', () => {
		const store = new CredentialStore({} as App);
		expect(store.secure).toBe(false);
		expect(store.set('acc-1', 'hunter2')).toBe(false);
		expect(store.get('acc-1')).toBeNull();
	});
});

const SOURCES: FullCalendarSource[] = [
	{
		type: 'caldav',
		name: '我的日历（钉钉）',
		color: '#b1c4e2',
		id: 'caldav_1',
		url: 'https://calendar.dingtalk.com/',
		homeUrl: 'https://calendar.dingtalk.com/dav/u_rmqleiut/primary/',
		username: 'u_rmqleiut',
	},
	{
		type: 'caldav',
		name: '日历',
		color: '#CC73E1',
		id: 'caldav_2',
		url: 'https://p216-caldav.icloud.com.cn/',
		homeUrl: 'https://p216-caldav.icloud.com.cn/16535323514/calendars/465E63E7/',
		username: 'bensom98@icloud.com',
	},
	{
		type: 'caldav',
		name: '个人工作',
		color: '#FF9500',
		id: 'caldav_3',
		url: 'https://p216-caldav.icloud.com.cn/',
		homeUrl: 'https://p216-caldav.icloud.com.cn/16535323514/calendars/49C1861E/',
		username: 'bensom98@icloud.com',
	},
];

describe('groupFullCalendarSources', () => {
	it('groups sources that share a server and a user name', () => {
		const accounts = groupFullCalendarSources(SOURCES);
		expect(accounts).toHaveLength(2);

		const dingtalk = accounts[0];
		expect(dingtalk.url).toBe('https://calendar.dingtalk.com/');
		expect(dingtalk.username).toBe('u_rmqleiut');
		expect(dingtalk.calendars).toHaveLength(1);
		expect(dingtalk.calendars[0].selected).toBe(true);
		expect(dingtalk.calendars[0].url).toContain('/dav/u_rmqleiut/primary/');

		const icloud = accounts[1];
		expect(icloud.username).toBe('bensom98@icloud.com');
		expect(icloud.calendars.map((calendar) => calendar.name)).toEqual(['日历', '个人工作']);
		expect(icloud.calendars.every((calendar) => calendar.selected)).toBe(true);
	});

	it('knows the secret ids of the other plugin', () => {
		expect(fullCalendarSecretId('caldav_1')).toBe('fcr-caldav-pwd-caldav-1');
		expect(fullCalendarSecretId('caldav_13')).toBe('fcr-caldav-pwd-caldav-13');

		const accounts = groupFullCalendarSources(SOURCES);
		expect(accounts[0].secretIds).toEqual(['fcr-caldav-pwd-caldav-1']);
		expect(accounts[1].secretIds).toEqual([
			'fcr-caldav-pwd-caldav-2',
			'fcr-caldav-pwd-caldav-3',
		]);
	});

	it('ignores sources that are not CalDAV', () => {
		const accounts = groupFullCalendarSources([
			{ type: 'google', name: 'Google', url: 'https://google.com' },
			{ type: 'caldav', name: '会议', url: 'https://example.com/', username: 'me' },
		]);
		expect(accounts).toHaveLength(1);
		expect(accounts[0].username).toBe('me');
	});
});
