import type { App } from 'obsidian';
import type { CalendarEvent, EventSource, FilenameSettings } from '../core/types';
import { parseDateValue } from '../core/dateUtils';
import { matchesFolder } from './folders';

interface FormatPattern {
	regex: RegExp;
	tokens: string[];
}

/**
 * Recognises dates written into file names, e.g. `2026-10-30.md` or
 * `2026-10-30-周会.md`.
 *
 * The formats are user settings (`YYYY-MM-DD`, `YYYY.MM.DD`, …) so the plugin
 * fits any naming convention instead of one.
 */
export class FilenameSource implements EventSource {
	readonly id = 'filename';

	constructor(
		private readonly app: App,
		private readonly getSettings: () => FilenameSettings,
	) {}

	collect(): CalendarEvent[] {
		const settings = this.getSettings();
		if (!settings.enabled || settings.formats.length === 0) return [];

		const patterns = settings.formats
			.map((format) => buildPattern(format))
			.filter((pattern): pattern is FormatPattern => pattern !== null);

		if (patterns.length === 0) return [];

		const events: CalendarEvent[] = [];

		for (const file of this.app.vault.getMarkdownFiles()) {
			if (!matchesFolder(file.path, settings)) continue;

			const match = findDate(file.basename, patterns);
			if (!match) continue;

			const parsed = parseDateValue(match.iso);
			if (!parsed) continue;

			events.push({
				id: `filename:${file.path}`,
				source: 'filename',
				title: cleanTitle(file.basename, match.text),
				start: parsed.date,
				allDay: !parsed.hasTime,
				filePath: file.path,
				calendar: 'filename',
				meta: { kind: 'allDay' },
			});
		}

		return events;
	}
}

const TOKEN_PATTERNS: { token: string; pattern: string }[] = [
	{ token: 'YYYY', pattern: '(\\d{4})' },
	{ token: 'YY', pattern: '(\\d{2})' },
	{ token: 'MM', pattern: '(\\d{2})' },
	{ token: 'DD', pattern: '(\\d{2})' },
	{ token: 'M', pattern: '(\\d{1,2})' },
	{ token: 'D', pattern: '(\\d{1,2})' },
];

export function buildPattern(format: string): FormatPattern | null {
	if (!format || !format.trim()) return null;

	let regex = '';
	const tokens: string[] = [];
	let index = 0;

	while (index < format.length) {
		const rest = format.slice(index);
		const token = TOKEN_PATTERNS.find((candidate) => rest.startsWith(candidate.token));
		if (token) {
			regex += token.pattern;
			tokens.push(token.token);
			index += token.token.length;
		} else {
			regex += escapeRegExp(format[index]);
			index += 1;
		}
	}

	return { regex: new RegExp(regex), tokens };
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface DateMatch {
	iso: string;
	text: string;
}

export function findDate(basename: string, patterns: FormatPattern[]): DateMatch | null {
	for (const pattern of patterns) {
		const match = pattern.regex.exec(basename);
		if (!match) continue;

		let year = '';
		let month = '';
		let day = '';
		pattern.tokens.forEach((token, index) => {
			const value = match[index + 1];
			switch (token) {
				case 'YYYY':
					year = value;
					break;
				case 'YY':
					year = `20${value}`;
					break;
				case 'MM':
				case 'M':
					month = value;
					break;
				case 'DD':
				case 'D':
					day = value;
					break;
			}
		});

		if (!year || !month || !day) continue;
		const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
		if (Number(month) < 1 || Number(month) > 12) continue;
		if (Number(day) < 1 || Number(day) > 31) continue;

		return { iso, text: match[0] };
	}
	return null;
}

/** Title from the file name once the date has been removed. */
export function cleanTitle(basename: string, dateText: string): string {
	const withoutDate = basename.replace(dateText, '');
	const cleaned = withoutDate.replace(/^[\s._\-–—]+|[\s._\-–—]+$/g, '').trim();
	return cleaned || basename;
}
