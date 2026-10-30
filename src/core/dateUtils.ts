/**
 * Date helpers.
 *
 * Deliberately dependency-free and locale-agnostic in their arithmetic: all
 * keys are local-time `YYYY-MM-DD` strings, never UTC. Formatting goes through
 * `Intl` so the plugin stays independent of Obsidian's bundled Moment.
 */

export function pad2(value: number): string {
	return value < 10 ? `0${value}` : String(value);
}

/** Local-time `YYYY-MM-DD` key. */
export function toDateKey(date: Date): string {
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function fromDateKey(key: string): Date {
	const [year, month, day] = key.split('-').map((part) => Number(part));
	return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, amount: number): Date {
	const next = new Date(date.getTime());
	next.setDate(next.getDate() + amount);
	return next;
}

export function addMonths(date: Date, amount: number): Date {
	const next = new Date(date.getTime());
	next.setDate(1);
	next.setMonth(next.getMonth() + amount);
	return next;
}

export function startOfWeek(date: Date, weekStart: number): Date {
	const day = startOfDay(date);
	const diff = (day.getDay() - weekStart + 7) % 7;
	return addDays(day, -diff);
}

export function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

export function isToday(date: Date): boolean {
	return isSameDay(date, new Date());
}

/**
 * 42 cells (six weeks) covering the month of `anchor`, starting on the
 * configured first day of the week. A fixed six-week grid keeps the month
 * height stable while paging — the behaviour people expect from a native
 * calendar.
 */
export function buildMonthGrid(anchor: Date, weekStart: number): Date[] {
	const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
	const gridStart = startOfWeek(firstOfMonth, weekStart);
	const days: Date[] = [];
	for (let index = 0; index < 42; index += 1) {
		days.push(addDays(gridStart, index));
	}
	return days;
}

/** Inclusive list of date keys between two dates. */
export function enumerateDateKeys(from: Date, to: Date): string[] {
	const keys: string[] = [];
	let cursor = startOfDay(from);
	const last = startOfDay(to);
	while (cursor <= last) {
		keys.push(toDateKey(cursor));
		cursor = addDays(cursor, 1);
	}
	return keys;
}

export interface ParsedDate {
	date: Date;
	/** True when the source value carried a time component. */
	hasTime: boolean;
}

/**
 * Parse the date shapes people actually write in notes:
 * `YYYY-MM-DD`, `YYYY/MM/DD`, `YYYY.MM.DD`, `YYYY年M月D日`, ISO timestamps and
 * `YYYY-MM-DD HH:mm`. Anything else is left to the platform parser.
 */
export function parseDateValue(value: unknown): ParsedDate | null {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : { date: value, hasTime: true };
	}
	if (typeof value === 'number' && Number.isFinite(value)) {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? null : { date, hasTime: true };
	}
	if (typeof value !== 'string') return null;

	const raw = value.trim();
	if (!raw) return null;

	const dateTime =
		/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(raw);
	if (dateTime) {
		const [, year, month, day, hour, minute, second] = dateTime;
		const date = new Date(
			Number(year),
			Number(month) - 1,
			Number(day),
			Number(hour),
			Number(minute),
			second ? Number(second) : 0,
		);
		return Number.isNaN(date.getTime()) ? null : { date, hasTime: true };
	}

	const dateOnly = /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/.exec(raw);
	if (dateOnly) {
		const [, year, month, day] = dateOnly;
		const date = new Date(Number(year), Number(month) - 1, Number(day));
		return Number.isNaN(date.getTime()) ? null : { date, hasTime: false };
	}

	const fallback = new Date(raw);
	if (Number.isNaN(fallback.getTime())) return null;
	return { date: fallback, hasTime: true };
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

export function formatMonthTitle(date: Date, locale: string): string {
	return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(date);
}

export function formatFullDate(date: Date, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		weekday: 'long',
	}).format(date);
}

export function formatTime(date: Date, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	}).format(date);
}

/** Weekday headers ordered by the configured first day of the week. */
export function weekdayLabels(locale: string, weekStart: number): string[] {
	// 2023-01-01 was a Sunday — a stable anchor for weekday names.
	const sunday = new Date(2023, 0, 1);
	return Array.from({ length: 7 }, (_, index) => {
		const date = new Date(sunday.getTime());
		date.setDate(sunday.getDate() + ((weekStart + index) % 7));
		return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
	});
}

/** Weekend positions expressed as indexes into the week (0 = first column). */
export function weekendIndexes(weekStart: number): number[] {
	const saturday = (6 - weekStart + 7) % 7;
	return [saturday, (saturday + 1) % 7];
}

/** ISO-8601 week number, used by the optional week-number column. */
export function isoWeekNumber(date: Date): number {
	const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const dayNumber = (target.getDay() + 6) % 7;
	target.setDate(target.getDate() - dayNumber + 3);
	const firstThursday = new Date(target.getFullYear(), 0, 4);
	const firstDayNumber = (firstThursday.getDay() + 6) % 7;
	firstThursday.setDate(firstThursday.getDate() - firstDayNumber + 3);
	return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

/**
 * Format a date with a `YYYY-MM-DD`-style pattern.
 *
 * The token set is deliberately small — it covers daily-note file names and
 * the templates users write. Unknown tokens are left untouched so a broken
 * pattern is visible instead of silently wrong.
 */
export function formatDatePattern(
	date: Date,
	pattern: string,
	locale = 'en-US',
): string {
	const pad = (value: number, size = 2) => String(value).padStart(size, '0');
	const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
	const weekdayShort = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);

	const tokens: [string, string][] = [
		['YYYY', String(date.getFullYear())],
		['YY', String(date.getFullYear()).slice(-2)],
		['MM', pad(date.getMonth() + 1)],
		['M', String(date.getMonth() + 1)],
		['DD', pad(date.getDate())],
		['D', String(date.getDate())],
		['dddd', weekdayLong],
		['ddd', weekdayShort],
		['WW', pad(isoWeekNumber(date))],
		['HH', pad(date.getHours())],
		['mm', pad(date.getMinutes())],
	];

	let result = pattern;
	for (const [token, value] of tokens) {
		result = result.split(token).join(value);
	}
	return result;
}
