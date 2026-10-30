/**
 * Import from Full Calendar Remastered.
 *
 * That plugin is the most common calendar plugin in Obsidian, so people who
 * try Calendar Studio usually have accounts already configured there. This
 * module reads the other plugin's settings file, groups its sources into
 * accounts and turns them into ours.
 *
 * The passwords live in Obsidian's secret storage, not in the file, so the
 * importer asks the secret storage for them as well.
 */

import type { CalDavCalendarSetting } from '../core/types';

/** One entry of the other plugin's `calendarSources` array. */
export interface FullCalendarSource {
	type?: string;
	name?: string;
	color?: string;
	id?: string;
	url?: string;
	homeUrl?: string;
	username?: string;
	password?: string;
}

/** One account after the import. */
export interface ImportedAccount {
	/** Server URL of the account. */
	url: string;
	/** User name of the account. */
	username: string;
	/** Display name of the account. */
	name: string;
	/** Colour of the account. */
	color: string;
	/** The calendars of the account, all selected. */
	calendars: CalDavCalendarSetting[];
	/** Secret ids of the other plugin that may hold the password. */
	secretIds: string[];
}

/** Id of the other plugin's folder inside the vault config directory. */
export const FULL_CALENDAR_PLUGIN_ID = 'full-calendar-remastered';

/**
 * The secret id the other plugin uses for a source.
 *
 * Its own rule is `fcr-caldav-pwd-<id>` with the id lowercased and every
 * character that is not a letter or a digit replaced by a dash.
 */
export function fullCalendarSecretId(sourceId: string): string {
	const cleaned = sourceId
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return `fcr-caldav-pwd-${cleaned}`;
}

/**
 * Group the sources of the other plugin into accounts.
 *
 * Sources that share a server and a user name belong to the same account;
 * their collections become the calendars of that account.
 */
export function groupFullCalendarSources(
	sources: FullCalendarSource[],
): ImportedAccount[] {
	const groups = new Map<string, ImportedAccount>();

	for (const source of sources) {
		if (source.type && source.type !== 'caldav') continue;
		const url = (source.url ?? '').trim();
		if (!url) continue;
		const username = (source.username ?? '').trim();
		const key = `${url}|${username}`;

		let group = groups.get(key);
		if (!group) {
			group = {
				url,
				username,
				name: '',
				color: source.color ?? '#6b7fd7',
				calendars: [],
				secretIds: [],
			};
			groups.set(key, group);
		}

		const collection = (source.homeUrl ?? '').trim();
		if (collection) {
			group.calendars.push({
				url: collection,
				name: (source.name ?? '').trim() || collection,
				color: source.color,
				selected: true,
			});
		}
		if (source.id && !group.secretIds.includes(fullCalendarSecretId(source.id))) {
			group.secretIds.push(fullCalendarSecretId(source.id));
		}
		if (!group.name) {
			group.name = firstCalendarName(group) ?? url;
		}
	}

	return [...groups.values()];
}

/** The name of the first calendar of an account, used as the account name. */
function firstCalendarName(group: ImportedAccount): string | undefined {
	return group.calendars[0]?.name;
}
