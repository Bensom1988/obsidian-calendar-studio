/**
 * A tiny template engine for note templates.
 *
 * Deliberately minimal and predictable: `{{token}}` placeholders, plus
 * `{{token:FORMAT}}` for date formatting. Anything unknown is left untouched
 * so a template can carry literal braces.
 */

import { formatDatePattern } from './dateUtils';

export interface TemplateContext {
	[key: string]: string | number | Date | undefined;
}

/**
 * Replace `{{name}}` and `{{name:FORMAT}}` placeholders.
 *
 * A `FORMAT` containing only date tokens formats a Date value; otherwise the
 * value is stringified as-is.
 */
export function renderTemplate(template: string, context: TemplateContext): string {
	return template.replace(/\{\{\s*([\w.-]+)\s*(?::\s*([^}]+))?\s*\}\}/g, (match, name: string, format?: string) => {
		if (!(name in context)) return match;
		const value = context[name];
		if (value === undefined || value === null) return '';
		if (value instanceof Date) {
			return format ? formatDatePattern(value, format.trim()) : formatDatePattern(value, 'YYYY-MM-DD');
		}
		return String(value);
	});
}

/** Names of every placeholder used in a template. */
export function templateTokens(template: string): string[] {
	const names = new Set<string>();
	const pattern = /\{\{\s*([\w.-]+)/g;
	let match = pattern.exec(template);
	while (match) {
		names.add(match[1]);
		match = pattern.exec(template);
	}
	return [...names];
}
