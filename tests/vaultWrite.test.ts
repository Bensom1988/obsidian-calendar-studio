import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import { TFile, TFolder } from 'obsidian';
import { createOrUpdateDailyNote, dailyNotePath, AGENDA_START } from '../src/workflow/dailyNote';
import { generateTasksForDay } from '../src/workflow/taskGenerator';
import { DEFAULT_SETTINGS, type CalendarEvent, type WorkflowSettings } from '../src/core/types';

/**
 * A stand-in for the vault.
 *
 * The workflow helpers only use a handful of vault calls, so a small fake is
 * enough to prove the write behaviour: what lands in a note, what is left
 * alone, and what happens on a second run.
 */
class FakeVault {
	files = new Map<string, TFile>();
	folders = new Set<string>();
	contents = new Map<string, string>();
	writes: { path: string; content: string }[] = [];

	add(path: string, content = ''): TFile {
		const file = new TFile();
		file.path = path;
		file.basename = (path.split('/').pop() ?? path).replace(/\.md$/, '');
		file.stat.mtime = this.files.size + 1;
		this.files.set(path, file);
		this.contents.set(path, content);
		return file;
	}

	getMarkdownFiles(): TFile[] {
		return [...this.files.values()];
	}

	getAbstractFileByPath(path: string): TFile | TFolder | null {
		const file = this.files.get(path);
		if (file) return file;
		if (this.folders.has(path)) {
			const folder = new TFolder();
			folder.path = path;
			return folder;
		}
		return null;
	}

	async cachedRead(file: TFile): Promise<string> {
		return this.contents.get(file.path) ?? '';
	}

	async create(path: string, content: string): Promise<TFile> {
		this.add(path, content);
		this.writes.push({ path, content });
		return this.files.get(path) as TFile;
	}

	async modify(file: TFile, content: string): Promise<void> {
		this.contents.set(file.path, content);
		this.writes.push({ path: file.path, content });
	}

	async createFolder(path: string): Promise<void> {
		this.folders.add(path);
	}
}

function fakeApp(vault: FakeVault): App {
	return { vault } as unknown as App;
}

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
	return {
		id: 'test:1',
		source: 'frontmatter',
		title: '写周报',
		start: new Date(2026, 9, 30, 10, 0),
		allDay: false,
		...overrides,
	};
}

const workflow: WorkflowSettings = {
	...DEFAULT_SETTINGS.workflow,
	useCoreDailyNotes: false,
	dailyNoteFolder: 'Daily',
	dailyNoteFormat: 'YYYY-MM-DD',
};

describe('createOrUpdateDailyNote', () => {
	it('creates the note with the agenda', async () => {
		const vault = new FakeVault();
		const outcome = await createOrUpdateDailyNote(
			fakeApp(vault),
			new Date(2026, 9, 30),
			[event()],
			workflow,
			'zh-CN',
		);

		expect(outcome.created).toBe(true);
		expect(outcome.path).toBe('Daily/2026-10-30.md');
		const content = vault.contents.get('Daily/2026-10-30.md') ?? '';
		expect(content).toContain(AGENDA_START);
		expect(content).toContain('写周报');
	});

	it('creates the folder when it is missing', async () => {
		const vault = new FakeVault();
		await createOrUpdateDailyNote(
			fakeApp(vault),
			new Date(2026, 9, 30),
			[],
			{ ...workflow, dailyNoteFolder: '日记/2026' },
			'zh-CN',
		);
		expect(vault.folders.has('日记')).toBe(true);
		expect(vault.folders.has('日记/2026')).toBe(true);
	});

	it('does not duplicate the agenda on a second run', async () => {
		const vault = new FakeVault();
		const app = fakeApp(vault);
		await createOrUpdateDailyNote(app, new Date(2026, 9, 30), [event()], workflow, 'zh-CN');
		const second = await createOrUpdateDailyNote(app, new Date(2026, 9, 30), [event()], workflow, 'zh-CN');

		expect(second.created).toBe(false);
		const content = vault.contents.get('Daily/2026-10-30.md') ?? '';
		expect(content.split(AGENDA_START)).toHaveLength(2);
	});

	it('keeps what the user wrote', async () => {
		const vault = new FakeVault();
		vault.add('Daily/2026-10-30.md', '# 我的日记\n\n这是我自己写的内容。\n');
		const app = fakeApp(vault);

		await createOrUpdateDailyNote(app, new Date(2026, 9, 30), [event()], workflow, 'zh-CN');

		const content = vault.contents.get('Daily/2026-10-30.md') ?? '';
		expect(content).toContain('这是我自己写的内容。');
		expect(content).toContain('写周报');
	});

	it('replaces an outdated agenda instead of adding a second one', async () => {
		const vault = new FakeVault();
		const app = fakeApp(vault);
		await createOrUpdateDailyNote(app, new Date(2026, 9, 30), [event({ title: '旧安排' })], workflow, 'zh-CN');
		await createOrUpdateDailyNote(app, new Date(2026, 9, 30), [event({ title: '新安排' })], workflow, 'zh-CN');

		const content = vault.contents.get('Daily/2026-10-30.md') ?? '';
		expect(content).toContain('新安排');
		expect(content).not.toContain('旧安排');
	});

	it('uses the template file when one is configured', async () => {
		const vault = new FakeVault();
		vault.add('Templates/Daily.md', '# {{title}}\n\n今天：{{date:YYYY年MM月DD日}}\n\n{{events}}\n');
		const app = fakeApp(vault);

		await createOrUpdateDailyNote(
			app,
			new Date(2026, 9, 30),
			[event()],
			{ ...workflow, templatePath: 'Templates/Daily.md' },
			'zh-CN',
		);

		const content = vault.contents.get('Daily/2026-10-30.md') ?? '';
		expect(content).toContain('2026年10月30日');
		expect(content).toContain('写周报');
	});
});

describe('generateTasksForDay', () => {
	it('writes the events as tasks into the daily note', async () => {
		const vault = new FakeVault();
		const outcome = await generateTasksForDay(
			fakeApp(vault),
			new Date(2026, 9, 30),
			[event()],
			workflow,
			'zh-CN',
		);

		expect(outcome.count).toBe(1);
		expect(outcome.path).toBe('Daily/2026-10-30.md');
		const content = vault.contents.get('Daily/2026-10-30.md') ?? '';
		expect(content).toContain('- [ ] 写周报 📅 2026-10-30');
	});

	it('writes into the configured target note', async () => {
		const vault = new FakeVault();
		await generateTasksForDay(
			fakeApp(vault),
			new Date(2026, 9, 30),
			[event()],
			{ ...workflow, taskTargetPath: 'Tasks/2026-10-30.md' },
			'zh-CN',
		);
		expect(vault.files.has('Tasks/2026-10-30.md')).toBe(true);
	});

	it('uses the task template file', async () => {
		const vault = new FakeVault();
		vault.add('Templates/Tasks.md', '- [ ] {{title}} #计划 📅 {{date}}\n');
		await generateTasksForDay(
			fakeApp(vault),
			new Date(2026, 9, 30),
			[event()],
			{ ...workflow, taskTemplatePath: 'Templates/Tasks.md' },
			'zh-CN',
		);
		const content = vault.contents.get('Daily/2026-10-30.md') ?? '';
		expect(content).toContain('- [ ] 写周报 #计划 📅 2026-10-30');
	});

	it('does not duplicate tasks on a second run', async () => {
		const vault = new FakeVault();
		const app = fakeApp(vault);
		await generateTasksForDay(app, new Date(2026, 9, 30), [event()], workflow, 'zh-CN');
		await generateTasksForDay(app, new Date(2026, 9, 30), [event()], workflow, 'zh-CN');

		const content = vault.contents.get('Daily/2026-10-30.md') ?? '';
		expect(content.split('- [ ] 写周报').length - 1).toBe(1);
	});

	it('keeps other tasks in the target note', async () => {
		const vault = new FakeVault();
		vault.add('Tasks/2026-10-30.md', '# 任务\n\n- [ ] 我自己写的任务\n');
		await generateTasksForDay(
			fakeApp(vault),
			new Date(2026, 9, 30),
			[event()],
			{ ...workflow, taskTargetPath: 'Tasks/2026-10-30.md' },
			'zh-CN',
		);
		const content = vault.contents.get('Tasks/2026-10-30.md') ?? '';
		expect(content).toContain('我自己写的任务');
		expect(content).toContain('写周报');
	});
});

describe('dailyNotePath', () => {
	it('honours the folder and the format', () => {
		expect(dailyNotePath(fakeApp(new FakeVault()), new Date(2026, 9, 30), workflow)).toBe(
			'Daily/2026-10-30.md',
		);
	});
});
