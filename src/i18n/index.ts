import en from '../lang/locale/en';
import zhCN from '../lang/locale/zh-CN';
import type { UiLanguage } from '../core/types';

const dictionaries: Record<UiLanguage, Record<string, string>> = {
	en,
	'zh-CN': zhCN,
};

export type TranslateVars = Record<string, string | number>;

/** Replace `{{token}}` placeholders. */
export function interpolate(template: string, vars?: TranslateVars): string {
	if (!vars) return template;
	return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
		key in vars ? String(vars[key]) : match,
	);
}

/**
 * Translate a key for the given language, falling back to English and then to
 * the key itself so a missing string is visible instead of silently empty.
 */
export function translate(
	language: UiLanguage,
	key: string,
	vars?: TranslateVars,
): string {
	const dictionary = dictionaries[language] ?? dictionaries.en;
	const template = dictionary[key] ?? dictionaries.en[key] ?? key;
	return interpolate(template, vars);
}

/** Convenience: a bound translator. */
export function makeTranslator(language: UiLanguage) {
	return (key: string, vars?: TranslateVars) => translate(language, key, vars);
}

export type Translate = (key: string, vars?: TranslateVars) => string;
