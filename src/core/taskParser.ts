/**
 * Task-line parsing.
 *
 * Pure functions — no Obsidian APIs — so the behaviour is unit-testable and
 * can be reused by other sources.
 *
 * Two notations are understood:
 *
 *   - Tasks plugin emoji:  `- [ ] 写周报 📅 2026-10-30 ⏳ 2026-10-25`
 *   - Tasks plugin fields: `- [ ] 写周报 [due:: 2026-10-30]`
 */

export type TaskStatus = 'todo' | 'done' | 'in-progress' | 'cancelled';

/** The date-carrying fields of a task. */
export type TaskDateField = 'due' | 'scheduled' | 'start' | 'created' | 'completed';

export interface ParsedTask {
	status: TaskStatus;
	/** Task text with date markers, inline fields and the filter tag removed. */
	text: string;
	/** The original line. */
	raw: string;
	due?: Date;
	scheduled?: Date;
	start?: Date;
	created?: Date;
	completed?: Date;
}

const TASK_LINE = /^\s*[-*+]\s+\[([^\]])\]\s?(.*)$/;

/** Emoji date markers and the field each one stands for. */
const EMOJI_MARKERS: { emoji: string; field: TaskDateField }[] = [
	{ emoji: '📅', field: 'due' },
	{ emoji: '⏳', field: 'scheduled' },
	{ emoji: '🛫', field: 'start' },
	{ emoji: '➕', field: 'created' },
	{ emoji: '✅', field: 'completed' },
];

/** Inline field notation: `[due:: 2026-10-30]`. */
const INLINE_FIELDS: { name: string; field: TaskDateField }[] = [
	{ name: 'due', field: 'due' },
	{ name: 'scheduled', field: 'scheduled' },
	{ name: 'start', field: 'start' },
	{ name: 'created', field: 'created' },
	{ name: 'done', field: 'completed' },
	{ name: 'completion', field: 'completed' },
];

const DATE = String.raw`\d{4}-\d{2}-\d{2}`;

/**
 * The patterns are compiled once.
 *
 * A vault holds hundreds of thousands of lines; building eleven regular
 * expressions per line is the difference between a snappy plugin and one
 * that freezes Obsidian for seconds.
 */
const INLINE_PATTERNS = INLINE_FIELDS.map(({ name, field }) => ({
	field,
	pattern: new RegExp(String.raw`\[\s*${name}\s*::\s*(${DATE})[^\]]*\]`, 'gi'),
}));

const EMOJI_PATTERNS = EMOJI_MARKERS.map(({ emoji, field }) => ({
	field,
	pattern: new RegExp(`${emoji}\\s*(${DATE})`, 'g'),
}));

/** Cheap pre-filter: a task line always starts with a list marker. */
const TASK_MARKER = /^\s*[-*+]\s+\[/;

function statusOf(mark: string): TaskStatus {
	switch (mark.trim().toLowerCase()) {
		case 'x':
			return 'done';
		case '>':
			return 'in-progress';
		case '-':
			return 'cancelled';
		default:
			return 'todo';
	}
}

/**
 * Parse one line of Markdown.
 *
 * Returns `null` when the line is not a task line.
 */
export function parseTaskLine(line: string): ParsedTask | null {
	if (!TASK_MARKER.test(line)) return null;

	const match = TASK_LINE.exec(line);
	if (!match) return null;

	const status = statusOf(match[1]);
	let text = match[2] ?? '';
	const dates: Partial<Record<TaskDateField, Date>> = {};

	// Inline fields first: they may sit anywhere in the line.
	for (const { field, pattern } of INLINE_PATTERNS) {
		pattern.lastIndex = 0;
		const found = pattern.exec(text);
		if (!found) continue;
		const date = parseIsoDate(found[1]);
		if (date) dates[field] = date;
		text = text.replace(pattern, ' ');
	}

	// Then the emoji markers.
	for (const { field, pattern } of EMOJI_PATTERNS) {
		pattern.lastIndex = 0;
		const found = pattern.exec(text);
		if (!found) continue;
		const date = parseIsoDate(found[1]);
		if (date && !(field in dates)) dates[field] = date;
		text = text.replace(pattern, ' ');
	}

	return { status, text: cleanText(text), raw: line, ...dates };
}

/** Compiled filter patterns, cached — one per distinct filter string. */
const filterPatterns = new Map<string, RegExp>();

/** Remove the filter tag and collapse the whitespace the removals left behind. */
export function cleanText(text: string, globalFilter = ''): string {
	let result = text;
	if (globalFilter) {
		let pattern = filterPatterns.get(globalFilter);
		if (!pattern) {
			const escaped = globalFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			pattern = new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'g');
			filterPatterns.set(globalFilter, pattern);
		}
		pattern.lastIndex = 0;
		result = result.replace(pattern, ' ');
	}
	return result.replace(/\s{2,}/g, ' ').trim();
}

/** Parse `YYYY-MM-DD` into a local midnight Date. */
export function parseIsoDate(value: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
	if (!match) return null;
	const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
	return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Every date a task carries, as calendar events.
 *
 * A task with a start and a due date shows up on both days — that is what a
 * calendar user expects, so each marker becomes its own event.
 */
export function taskDates(task: ParsedTask): { date: Date; field: string }[] {
	const dates: { date: Date; field: string }[] = [];
	const fields: TaskDateField[] = ['start', 'scheduled', 'due'];
	for (const field of fields) {
		const date = task[field];
		if (date) dates.push({ date, field });
	}
	return dates;
}

/** Format a task back into a Markdown checkbox line. */
export function formatTaskLine(
	text: string,
	options: { due?: Date; globalFilter?: string; done?: boolean } = {},
): string {
	const mark = options.done ? 'x' : ' ';
	const parts = [`- [${mark}] ${text}`];
	if (options.due) {
		const due = options.due;
		const stamp = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(
			due.getDate(),
		).padStart(2, '0')}`;
		parts.push(`📅 ${stamp}`);
	}
	if (options.globalFilter) parts.push(options.globalFilter);
	return parts.join(' ');
}
