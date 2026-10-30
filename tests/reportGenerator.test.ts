import { describe, expect, it } from 'vitest';
import { App, TFile, TFolder } from 'obsidian';
import {
	buildChatCompletionsUrl,
	createAiClient,
	resolveAiApiKey,
} from '../src/ai/client';
import {
	REPORT_END,
	REPORT_START,
	buildReportSummary,
	generatePeriodicReport,
	reportNotePath,
	reportPeriodRange,
} from '../src/workflow/reportGenerator';
import { DEFAULT_SETTINGS, type CalendarEvent } from '../src/core/types';
import { toDateKey } from '../src/core/dateUtils';

function fakeVaultApp(): App & { files: Map<string, string> } {
	const files = new Map<string, string>();
	const folders = new Set<string>();
	const app = {
		files,
		vault: {
			getAbstractFileByPath(path: string) {
				if (files.has(path)) {
					const file = new TFile();
					file.path = path;
					return file;
				}
				if (folders.has(path)) {
					const folder = new TFolder();
					folder.path = path;
					return folder;
				}
				return null;
			},
			async cachedRead(file: TFile) {
				return files.get(file.path) ?? '';
			},
			async create(path: string, content: string) {
				files.set(path, content);
			},
			async modify(file: TFile, content: string) {
				files.set(file.path, content);
			},
			async createFolder(path: string) {
				folders.add(path);
			},
		},
	};
	return app as unknown as App & { files: Map<string, string> };
}

function sampleEvents(): CalendarEvent[] {
	return [
		{
			id: 'caldav:1',
			source: 'caldav',
			title: '架构评审会',
			start: new Date(2026, 9, 28, 10, 0),
			allDay: false,
			calendar: '工作',
		},
		{
			id: 'tasks:done:1',
			source: 'tasks',
			title: '完成接口文档',
			start: new Date(2026, 9, 29),
			allDay: true,
			meta: { status: 'done' },
		},
		{
			id: 'tasks:open:1',
			source: 'tasks',
			title: '补充压测用例',
			start: new Date(2026, 9, 30),
			allDay: true,
			meta: { status: 'todo' },
		},
		{
			id: 'frontmatter:1',
			source: 'frontmatter',
			title: '版本里程碑',
			start: new Date(2026, 9, 30),
			allDay: true,
			filePath: 'Projects/v0.4.md',
		},
	];
}

describe('AI client helpers', () => {
	it('normalises the chat completions URL', () => {
		expect(buildChatCompletionsUrl('https://api.deepseek.com/v1/')).toBe(
			'https://api.deepseek.com/v1/chat/completions',
		);
		expect(
			buildChatCompletionsUrl('https://api.openai.com/v1/chat/completions'),
		).toBe('https://api.openai.com/v1/chat/completions');
	});

	it('resolves the API key from secret storage first, then environment', () => {
		expect(
			resolveAiApiKey({
				secretKey: 'sk-secret',
				envVarName: 'DEEPSEEK_API_KEY',
				env: { DEEPSEEK_API_KEY: 'sk-env' },
			}),
		).toBe('sk-secret');

		expect(
			resolveAiApiKey({
				secretKey: '',
				envVarName: 'DEEPSEEK_API_KEY',
				env: { DEEPSEEK_API_KEY: 'sk-env' },
			}),
		).toBe('sk-env');
	});

	it('sends an OpenAI-compatible request and returns the assistant message', async () => {
		let capturedUrl = '';
		let capturedAuth = '';
		const fakeFetch: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			capturedUrl = String(input);
			capturedAuth =
				(init?.headers as Record<string, string> | undefined)?.Authorization ?? '';
			return new Response(
				JSON.stringify({
					choices: [{ message: { content: '### 核心进展\n- 完成了接口文档' } }],
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			);
		}) as typeof fetch;

		const client = createAiClient(
			{
				baseUrl: 'https://api.deepseek.com/v1',
				model: 'deepseek-chat',
				apiKey: 'sk-test-123',
			},
			fakeFetch,
		);
		const text = await client.complete([{ role: 'user', content: '总结本周' }]);
		expect(capturedUrl).toBe('https://api.deepseek.com/v1/chat/completions');
		expect(capturedAuth).toBe('Bearer sk-test-123');
		expect(text).toContain('核心进展');
	});
});

describe('reportPeriodRange & reportNotePath', () => {
	const date = new Date(2026, 9, 30); // Friday, ISO week 44

	it('computes week, month, and year ranges', () => {
		const week = reportPeriodRange(date, 'week', 1);
		expect(toDateKey(week.from)).toBe('2026-10-26');
		expect(toDateKey(week.to)).toBe('2026-11-01');

		const month = reportPeriodRange(date, 'month', 1);
		expect(toDateKey(month.from)).toBe('2026-10-01');
		expect(toDateKey(month.to)).toBe('2026-10-31');

		const year = reportPeriodRange(date, 'year', 1);
		expect(toDateKey(year.from)).toBe('2026-01-01');
		expect(toDateKey(year.to)).toBe('2026-12-31');
	});

	it('builds configurable paths for weekly, monthly and annual reports', () => {
		const ai = { ...DEFAULT_SETTINGS.ai, reportFolder: 'Reports/2026' };
		expect(reportNotePath(date, 'week', ai)).toBe('Reports/2026/2026-W44.md');
		expect(reportNotePath(date, 'month', ai)).toBe('Reports/2026/2026-10.md');
		expect(reportNotePath(date, 'year', ai)).toBe('Reports/2026/2026.md');
	});
});

describe('buildReportSummary & generatePeriodicReport', () => {
	it('groups schedules, completed tasks, open tasks, and notes', () => {
		const summary = buildReportSummary(sampleEvents(), 'zh-CN', 'zh-CN');
		expect(summary.stats).toEqual({
			total: 4,
			schedules: 1,
			tasksDone: 1,
			tasksOpen: 1,
			notes: 1,
		});
		expect(summary.markdown).toContain('### 日程安排');
		expect(summary.markdown).toContain('### 已完成任务');
		expect(summary.markdown).toContain('### 待办任务');
		expect(summary.markdown).toContain('### 关联笔记与节点');
	});

	it('writes a periodic report with AI summary and preserves user notes on update', async () => {
		const app = fakeVaultApp();
		const settings = { ...DEFAULT_SETTINGS.ai, enabled: true };
		const outcome1 = await generatePeriodicReport({
			app,
			date: new Date(2026, 9, 30),
			period: 'week',
			weekStart: 1,
			events: sampleEvents(),
			settings,
			locale: 'zh-CN',
			language: 'zh-CN',
			aiClient: {
				async complete() {
					return '- **本周亮点**：完成了架构评审与接口文档。';
				},
			},
		});

		expect(outcome1.created).toBe(true);
		expect(outcome1.usedAi).toBe(true);
		expect(outcome1.path).toBe('Reports/2026-W44.md');
		const firstContent = app.files.get('Reports/2026-W44.md') ?? '';
		expect(firstContent).toContain('## AI 周期总结');
		expect(firstContent).toContain('本周亮点');

		// Simulate user adding personal reflection outside the managed block.
		app.files.set(
			'Reports/2026-W44.md',
			`${firstContent}\n## 个人复盘\n下周重点推进压测。\n`,
		);

		const outcome2 = await generatePeriodicReport({
			app,
			date: new Date(2026, 9, 30),
			period: 'week',
			weekStart: 1,
			events: sampleEvents(),
			settings: { ...settings, enabled: false },
			locale: 'zh-CN',
			language: 'zh-CN',
		});

		expect(outcome2.created).toBe(false);
		const updatedContent = app.files.get('Reports/2026-W44.md') ?? '';
		expect(updatedContent).toContain('## 个人复盘\n下周重点推进压测。');
		expect(updatedContent).toContain(REPORT_START);
		expect(updatedContent).toContain(REPORT_END);
	});
});
