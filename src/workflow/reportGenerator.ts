/**
 * Periodic report generator (weekly / monthly / annual) with optional AI summary.
 *
 * Rules:
 *  1. Works offline and without an AI key: it always writes a clean,
 *     structured Markdown summary of the period's events, tasks and notes.
 *  2. When AI is enabled and a key is available, it also asks the configured
 *     OpenAI-compatible model (e.g. DeepSeek) for a concise narrative review.
 *  3. Writes strictly via the Vault API between `REPORT_START` and
 *     `REPORT_END` markers so user notes outside the markers are preserved.
 */

import { App, TFile, normalizePath } from 'obsidian';
import type {
	AiReportSettings,
	CalendarEvent,
	ReportPeriod,
	UiLanguage,
} from '../core/types';
import {
	addDays,
	formatDatePattern,
	formatTime,
	isoWeekNumber,
	startOfWeek,
	toDateKey,
} from '../core/dateUtils';
import { ensureFolder } from '../core/vaultHelpers';
import type { AiClientLike, AiMessage } from '../ai/client';

export const REPORT_START = '<!-- calendar-studio:report:start -->';
export const REPORT_END = '<!-- calendar-studio:report:end -->';

export interface ReportStats {
	total: number;
	schedules: number;
	tasksDone: number;
	tasksOpen: number;
	notes: number;
}

export interface ReportSummary {
	stats: ReportStats;
	markdown: string;
}

export interface ReportOutcome {
	path: string;
	created: boolean;
	eventCount: number;
	usedAi: boolean;
	aiError?: string;
}

/** Inclusive day range (`from` .. `to`) for a periodic report. */
export function reportPeriodRange(
	date: Date,
	period: ReportPeriod,
	weekStart: 0 | 1 = 1,
): { from: Date; to: Date } {
	if (period === 'week') {
		const from = startOfWeek(date, weekStart);
		return { from, to: addDays(from, 6) };
	}
	if (period === 'month') {
		const from = new Date(date.getFullYear(), date.getMonth(), 1);
		const to = new Date(date.getFullYear(), date.getMonth() + 1, 0);
		return { from, to };
	}
	const from = new Date(date.getFullYear(), 0, 1);
	const to = new Date(date.getFullYear(), 11, 31);
	return { from, to };
}

/** Human-readable title for the report heading. */
export function reportPeriodTitle(
	date: Date,
	period: ReportPeriod,
	language: UiLanguage,
): string {
	const year = date.getFullYear();
	if (period === 'week') {
		const week = String(isoWeekNumber(date)).padStart(2, '0');
		return language === 'zh-CN'
			? `${year} 年第 ${week} 周报告`
			: `${year} Week ${week} Report`;
	}
	if (period === 'month') {
		const month = String(date.getMonth() + 1).padStart(2, '0');
		return language === 'zh-CN'
			? `${year} 年 ${month} 月报告`
			: `${year}-${month} Monthly Report`;
	}
	return language === 'zh-CN' ? `${year} 年度报告` : `${year} Annual Report`;
}

/** Target vault path for a periodic report. */
export function reportNotePath(
	date: Date,
	period: ReportPeriod,
	settings: AiReportSettings,
	locale = 'en-US',
): string {
	const folder = settings.reportFolder.trim().replace(/^\/+|\/+$/g, '');
	const pattern =
		period === 'week'
			? settings.weeklyFormat.trim() || 'YYYY-[W]WW'
			: period === 'month'
				? settings.monthlyFormat.trim() || 'YYYY-MM'
				: settings.yearlyFormat.trim() || 'YYYY';
	const name = formatDatePattern(date, pattern, locale);
	return normalizePath(folder ? `${folder}/${name}.md` : `${name}.md`);
}

/** Build the structured Markdown breakdown and counts for a period's events. */
export function buildReportSummary(
	events: CalendarEvent[],
	locale: string,
	language: UiLanguage,
): ReportSummary {
	const seen = new Set<string>();
	const unique: CalendarEvent[] = [];
	for (const event of events) {
		if (seen.has(event.id)) continue;
		seen.add(event.id);
		unique.push(event);
	}
	unique.sort((a, b) => a.start.getTime() - b.start.getTime());

	const schedules: CalendarEvent[] = [];
	const tasksDone: CalendarEvent[] = [];
	const tasksOpen: CalendarEvent[] = [];
	const notes: CalendarEvent[] = [];

	for (const event of unique) {
		if (event.source === 'tasks') {
			if (
				event.meta?.completed === true ||
				event.meta?.status === 'done' ||
				event.meta?.status === 'x'
			) {
				tasksDone.push(event);
			} else {
				tasksOpen.push(event);
			}
		} else if (event.source === 'caldav') {
			schedules.push(event);
		} else {
			notes.push(event);
		}
	}

	const stats: ReportStats = {
		total: unique.length,
		schedules: schedules.length,
		tasksDone: tasksDone.length,
		tasksOpen: tasksOpen.length,
		notes: notes.length,
	};

	const zh = language === 'zh-CN';
	const lines: string[] = [];

	lines.push(
		zh
			? `- **总计**：${stats.total} 项（日程 ${stats.schedules} · 已完成任务 ${stats.tasksDone} · 待办任务 ${stats.tasksOpen} · 笔记事项 ${stats.notes}）`
			: `- **Total**: ${stats.total} items (Schedules ${stats.schedules} · Completed tasks ${stats.tasksDone} · Open tasks ${stats.tasksOpen} · Notes ${stats.notes})`,
	);

	const formatItem = (item: CalendarEvent): string => {
		const day = toDateKey(item.start);
		const time = item.allDay ? '' : ` ${formatTime(item.start, locale)}`;
		const cal = item.calendar ? ` (${item.calendar})` : '';
		return `- ${day}${time} ${item.title}${cal}`;
	};

	if (schedules.length > 0) {
		lines.push('', zh ? '### 日程安排' : '### Schedules');
		for (const item of schedules) lines.push(formatItem(item));
	}

	if (tasksDone.length > 0) {
		lines.push('', zh ? '### 已完成任务' : '### Completed Tasks');
		for (const item of tasksDone) lines.push(formatItem(item));
	}

	if (tasksOpen.length > 0) {
		lines.push('', zh ? '### 待办任务' : '### Open Tasks');
		for (const item of tasksOpen) lines.push(formatItem(item));
	}

	if (notes.length > 0) {
		lines.push('', zh ? '### 关联笔记与节点' : '### Notes & Milestones');
		for (const item of notes) lines.push(formatItem(item));
	}

	return { stats, markdown: lines.join('\n') };
}

/** Build the system and user messages sent to the AI model. */
export function buildAiMessages(
	period: ReportPeriod,
	title: string,
	range: { from: Date; to: Date },
	summary: ReportSummary,
	language: UiLanguage,
	customSystemPrompt?: string,
): AiMessage[] {
	const zh = language === 'zh-CN';
	const defaultSystem = zh
		? '你是一位严谨的个人效率与复盘助手。请仅根据提供的日历日程、任务与笔记记录，用精炼的 Markdown 撰写周期总结（包含：核心进展、关键日程回顾、待跟进事项三个小节）。严禁编造输入中不存在的事实。'
		: 'You are a concise personal productivity assistant. Based strictly on the provided calendar schedules, tasks, and notes, write a brief Markdown periodic review with three sections: Key Progress, Schedule Highlights, and Follow-ups. Never fabricate facts.';

	const system = customSystemPrompt?.trim() || defaultSystem;
	const periodLabel = `${toDateKey(range.from)} ~ ${toDateKey(range.to)} (${period})`;
	const user = [
		`# ${title}`,
		`Period: ${periodLabel}`,
		'',
		summary.markdown,
	].join('\n');

	return [
		{ role: 'system', content: system },
		{ role: 'user', content: user },
	];
}

/** Replace the marked report block in place, or append it if absent. */
export function upsertReportBlock(content: string, block: string): string {
	const start = content.indexOf(REPORT_START);
	const end = content.indexOf(REPORT_END);
	if (start !== -1 && end !== -1 && end > start) {
		return content.slice(0, start) + block + content.slice(end + REPORT_END.length);
	}
	const separator = content.endsWith('\n') || content.length === 0 ? '' : '\n';
	return `${content}${separator}\n${block}\n`;
}

export interface GenerateReportOptions {
	app: App;
	date: Date;
	period: ReportPeriod;
	weekStart: 0 | 1;
	events: CalendarEvent[];
	settings: AiReportSettings;
	locale: string;
	language: UiLanguage;
	aiClient?: AiClientLike | null;
}

/**
 * Generate (or refresh) the weekly, monthly or annual report note.
 */
export async function generatePeriodicReport(
	options: GenerateReportOptions,
): Promise<ReportOutcome> {
	const { app, date, period, weekStart, events, settings, locale, language, aiClient } =
		options;
	const range = reportPeriodRange(date, period, weekStart);
	const title = reportPeriodTitle(date, period, language);
	const path = reportNotePath(date, period, settings, locale);
	const summary = buildReportSummary(events, locale, language);

	let aiNarrative = '';
	let usedAi = false;
	let aiError: string | undefined;

	if (settings.enabled && aiClient && summary.stats.total > 0) {
		try {
			const messages = buildAiMessages(
				period,
				title,
				range,
				summary,
				language,
				settings.systemPrompt,
			);
			aiNarrative = await aiClient.complete(messages);
			usedAi = Boolean(aiNarrative);
		} catch (error) {
			aiError = error instanceof Error ? error.message : String(error);
		}
	}

	const zh = language === 'zh-CN';
	const sections: string[] = [
		REPORT_START,
		`> ${toDateKey(range.from)} — ${toDateKey(range.to)}`,
		'',
	];
	if (aiNarrative) {
		sections.push(zh ? '## AI 周期总结' : '## AI Summary', '', aiNarrative.trim(), '');
	}
	sections.push(zh ? '## 事项汇总' : '## Period Overview', '', summary.markdown, REPORT_END);
	const block = sections.join('\n');

	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		const content = await app.vault.cachedRead(existing);
		const updated = upsertReportBlock(content, block);
		if (updated !== content) {
			await app.vault.modify(existing, updated);
		}
		return {
			path,
			created: false,
			eventCount: summary.stats.total,
			usedAi,
			aiError,
		};
	}

	const folder = path.split('/').slice(0, -1).join('/');
	if (folder) {
		await ensureFolder(app, folder);
	}
	const initial = `# ${title}\n\n${block}\n`;
	await app.vault.create(path, initial);
	return {
		path,
		created: true,
		eventCount: summary.stats.total,
		usedAi,
		aiError,
	};
}
