import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type CalendarStudioPlugin from './main';
import { translate } from './i18n';
import type { CalDavAccount, PropertyKind, PropertyRule } from './core/types';
import { normaliseFolder } from './sources/folders';

const KINDS: PropertyKind[] = ['start', 'due', 'end', 'allDay'];

export class CalendarStudioSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: CalendarStudioPlugin,
	) {
		super(app, plugin);
	}

	private t(key: string, vars?: Record<string, string | number>): string {
		return translate(this.plugin.settings.language, key, vars);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('cs-settings');

		this.renderGeneral(containerEl);
		this.renderFrontmatter(containerEl);
		this.renderFilenames(containerEl);
		this.renderTasks(containerEl);
		this.renderWorkflow(containerEl);
		this.renderAi(containerEl);
		this.renderCalDav(containerEl);
	}

	private renderGeneral(container: HTMLElement): void {
		new Setting(container).setName(this.t('settings.language')).setDesc(this.t('settings.languageDesc'));

		new Setting(container)
			.addDropdown((dropdown) =>
				dropdown
					.addOption('en', this.t('settings.languageEn'))
					.addOption('zh-CN', this.t('settings.languageZh'))
					.setValue(this.plugin.settings.language)
					.onChange(async (value) => {
						this.plugin.settings.language = value as 'en' | 'zh-CN';
						// Keep date formatting consistent with the interface language
						// unless the user has chosen a locale explicitly.
						this.plugin.settings.locale = value === 'zh-CN' ? 'zh-CN' : 'en-US';
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		new Setting(container).setName(this.t('settings.locale')).setDesc(this.t('settings.localeDesc'));

		new Setting(container)
			.addText((text) =>
				text
					.setPlaceholder('en-US')
					.setValue(this.plugin.settings.locale)
					.onChange(async (value) => {
						this.plugin.settings.locale = value.trim() || 'en-US';
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.weekStart'))
			.setDesc(this.t('settings.weekStartDesc'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption('0', this.t('settings.weekStartSunday'))
					.addOption('1', this.t('settings.weekStartMonday'))
					.setValue(String(this.plugin.settings.weekStart))
					.onChange(async (value) => {
						this.plugin.settings.weekStart = Number(value) as 0 | 1;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.showLunar'))
			.setDesc(this.t('settings.showLunarDesc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showLunar).onChange(async (value) => {
					this.plugin.settings.showLunar = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(container)
			.setName(this.t('settings.showWeekNumbers'))
			.setDesc(this.t('settings.showWeekNumbersDesc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showWeekNumbers).onChange(async (value) => {
					this.plugin.settings.showWeekNumbers = value;
					await this.plugin.saveSettings();
				}),
			);
	}

	private renderFrontmatter(container: HTMLElement): void {
		new Setting(container)
			.setName(this.t('source.frontmatter'))
			.setDesc(this.t('source.frontmatterDesc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.frontmatter.enabled).onChange(async (value) => {
					this.plugin.settings.frontmatter.enabled = value;
					await this.plugin.saveSettings();
				}),
			);

		this.renderFolderFilters(container, 'frontmatter');

		new Setting(container)
			.setName(this.t('settings.frontmatterRules'))
			.setDesc(this.t('settings.frontmatterRulesDesc'))
			.setHeading();

		const rules = this.plugin.settings.frontmatter.rules;
		rules.forEach((rule, index) => {
			const setting = new Setting(container).setClass('cs-rule-row');

			setting.addText((text) =>
				text
					.setPlaceholder(this.t('settings.propertyPlaceholder'))
					.setValue(rule.property)
					.onChange(async (value) => {
						rules[index].property = value.trim();
						await this.plugin.saveSettings();
					}),
			);

			setting.addDropdown((dropdown) => {
				for (const kind of KINDS) {
					dropdown.addOption(kind, this.t(`settings.kind${capitalise(kind)}`));
				}
				dropdown.setValue(rule.kind).onChange(async (value) => {
					rules[index].kind = value as PropertyKind;
					await this.plugin.saveSettings();
				});
			});

			setting.addExtraButton((button) =>
				button
					.setIcon('trash')
					.setTooltip(this.t('settings.removeRule'))
					.onClick(async () => {
						rules.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					}),
			);
		});

		new Setting(container).addButton((button) =>
			button
				.setButtonText(this.t('settings.addRule'))
				.setCta()
				.onClick(async () => {
					const rules = this.plugin.settings.frontmatter.rules;
					rules.push({ property: '', kind: 'due' });
					await this.plugin.saveSettings();
					this.display();
				}),
		);
	}

	private renderFilenames(container: HTMLElement): void {
		new Setting(container)
			.setName(this.t('source.filenames'))
			.setDesc(this.t('source.filenamesDesc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.filenames.enabled).onChange(async (value) => {
					this.plugin.settings.filenames.enabled = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(container)
			.setName(this.t('settings.filenameFormats'))
			.setDesc(this.t('settings.filenameFormatsDesc'))
			.addText((text) =>
				text
					.setPlaceholder('YYYY-MM-DD')
					.setValue(this.plugin.settings.filenames.formats.join(', '))
					.onChange(async (value) => {
						this.plugin.settings.filenames.formats = splitList(value);
						await this.plugin.saveSettings();
					}),
			);

		this.renderFolderFilters(container, 'filenames');
	}

	private renderTasks(container: HTMLElement): void {
		new Setting(container)
			.setName(this.t('source.tasks'))
			.setDesc(this.t('source.tasksDesc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.tasks.enabled).onChange(async (value) => {
					this.plugin.settings.tasks.enabled = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(container)
			.setName(this.t('settings.globalFilter'))
			.setDesc(this.t('settings.globalFilterDesc'))
			.addText((text) =>
				text
					.setPlaceholder('#task')
					.setValue(this.plugin.settings.tasks.globalFilter)
					.onChange(async (value) => {
						this.plugin.settings.tasks.globalFilter = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		this.renderFolderFilters(container, 'tasks');
	}

	/**
	 * Daily notes and task generation.
	 *
	 * Every path is a plain setting: the plugin must work in a vault it has
	 * never seen, so nothing about the folder layout is baked into the code.
	 */
	private renderWorkflow(container: HTMLElement): void {
		const workflow = this.plugin.settings.workflow;

		new Setting(container)
			.setName(this.t('settings.workflow'))
			.setDesc(this.t('settings.workflowDesc'))
			.setHeading();

		new Setting(container)
			.setName(this.t('settings.useCoreDailyNotes'))
			.setDesc(this.t('settings.useCoreDailyNotesDesc'))
			.addToggle((toggle) =>
				toggle.setValue(workflow.useCoreDailyNotes).onChange(async (value) => {
					workflow.useCoreDailyNotes = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(container)
			.setName(this.t('settings.dailyNoteFolder'))
			.setDesc(this.t('settings.dailyNoteFolderDesc'))
			.addText((text) =>
				text
					.setPlaceholder('Daily')
					.setValue(workflow.dailyNoteFolder)
					.onChange(async (value) => {
						workflow.dailyNoteFolder = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.dailyNoteFormat'))
			.setDesc(this.t('settings.dailyNoteFormatDesc'))
			.addText((text) =>
				text
					.setPlaceholder('YYYY-MM-DD')
					.setValue(workflow.dailyNoteFormat)
					.onChange(async (value) => {
						workflow.dailyNoteFormat = value.trim() || 'YYYY-MM-DD';
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.templatePath'))
			.setDesc(this.t('settings.templatePathDesc'))
			.addText((text) =>
				text
					.setPlaceholder('Templates/Daily.md')
					.setValue(workflow.templatePath)
					.onChange(async (value) => {
						workflow.templatePath = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.taskTemplatePath'))
			.setDesc(this.t('settings.taskTemplatePathDesc'))
			.addText((text) =>
				text
					.setPlaceholder('Templates/Tasks.md')
					.setValue(workflow.taskTemplatePath)
					.onChange(async (value) => {
						workflow.taskTemplatePath = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.taskTargetPath'))
			.setDesc(this.t('settings.taskTargetPathDesc'))
			.addText((text) =>
				text
					.setPlaceholder('Tasks/2026-10-30.md')
					.setValue(workflow.taskTargetPath)
					.onChange(async (value) => {
						workflow.taskTargetPath = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.exportFolder'))
			.setDesc(this.t('settings.exportFolderDesc'))
			.addText((text) =>
				text
					.setPlaceholder('Exports')
					.setValue(workflow.exportFolder)
					.onChange(async (value) => {
						workflow.exportFolder = value.trim();
						await this.plugin.saveSettings();
					}),
			);
	}

	private renderAi(container: HTMLElement): void {
		const ai = this.plugin.settings.ai;

		new Setting(container)
			.setName(this.t('settings.ai'))
			.setDesc(this.t('settings.aiDesc'))
			.setHeading();

		new Setting(container)
			.setName(this.t('settings.reportFolder'))
			.setDesc(this.t('settings.reportFolderDesc'))
			.addText((text) =>
				text
					.setPlaceholder('Reports')
					.setValue(ai.reportFolder)
					.onChange(async (value) => {
						ai.reportFolder = normaliseFolder(value);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.weeklyFormat'))
			.setDesc(this.t('settings.weeklyFormatDesc'))
			.addText((text) =>
				text
					.setPlaceholder('YYYY-[W]WW')
					.setValue(ai.weeklyFormat)
					.onChange(async (value) => {
						ai.weeklyFormat = value.trim() || 'YYYY-[W]WW';
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.monthlyFormat'))
			.setDesc(this.t('settings.monthlyFormatDesc'))
			.addText((text) =>
				text
					.setPlaceholder('YYYY-MM')
					.setValue(ai.monthlyFormat)
					.onChange(async (value) => {
						ai.monthlyFormat = value.trim() || 'YYYY-MM';
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.yearlyFormat'))
			.setDesc(this.t('settings.yearlyFormatDesc'))
			.addText((text) =>
				text
					.setPlaceholder('YYYY')
					.setValue(ai.yearlyFormat)
					.onChange(async (value) => {
						ai.yearlyFormat = value.trim() || 'YYYY';
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.aiEnabled'))
			.setDesc(this.t('settings.aiEnabledDesc'))
			.addToggle((toggle) =>
				toggle.setValue(ai.enabled).onChange(async (value) => {
					ai.enabled = value;
					await this.plugin.saveSettings();
					this.display();
				}),
			);

		if (!ai.enabled) return;

		new Setting(container)
			.setName(this.t('settings.aiBaseUrl'))
			.setDesc(this.t('settings.aiBaseUrlDesc'))
			.addText((text) =>
				text
					.setPlaceholder('https://api.deepseek.com/v1')
					.setValue(ai.baseUrl)
					.onChange(async (value) => {
						ai.baseUrl = value.trim() || 'https://api.deepseek.com/v1';
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.aiModel'))
			.setDesc(this.t('settings.aiModelDesc'))
			.addText((text) =>
				text
					.setPlaceholder('deepseek-chat')
					.setValue(ai.model)
					.onChange(async (value) => {
						ai.model = value.trim() || 'deepseek-chat';
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.aiApiKey'))
			.setDesc(this.t('settings.aiApiKeyDesc'))
			.addText((text) => {
				text.inputEl.type = 'password';
				text.setValue(this.plugin.getAiApiKey());
				text.inputEl.addEventListener('blur', () => {
					this.plugin.setAiApiKey(text.getValue().trim());
				});
			});

		new Setting(container)
			.setName(this.t('settings.aiApiKeyEnv'))
			.setDesc(this.t('settings.aiApiKeyEnvDesc'))
			.addText((text) =>
				text
					.setPlaceholder('DEEPSEEK_API_KEY')
					.setValue(ai.apiKeyEnv)
					.onChange(async (value) => {
						ai.apiKeyEnv = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.aiSystemPrompt'))
			.setDesc(this.t('settings.aiSystemPromptDesc'))
			.addTextArea((area) =>
				area
					.setValue(ai.systemPrompt)
					.onChange(async (value) => {
						ai.systemPrompt = value;
						await this.plugin.saveSettings();
					}),
			);
	}

	private renderCalDav(container: HTMLElement): void {
		const caldav = this.plugin.settings.caldav;

		new Setting(container)
			.setName(this.t('source.caldav'))
			.setDesc(this.t('source.caldavDesc'))
			.addToggle((toggle) =>
				toggle.setValue(caldav.enabled).onChange(async (value) => {
					caldav.enabled = value;
					await this.plugin.saveSettings();
					this.display();
				}),
			);

		if (!caldav.enabled) return;

		new Setting(container)
			.setName(this.t('settings.caldavAutoSync'))
			.setDesc(this.t('settings.caldavAutoSyncDesc'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption('0', this.t('settings.caldavAutoSyncOff'))
					.addOption('15', this.t('settings.caldavAutoSync15'))
					.addOption('30', this.t('settings.caldavAutoSync30'))
					.addOption('60', this.t('settings.caldavAutoSync60'))
					.addOption('180', this.t('settings.caldavAutoSync180'))
					.setValue(String(caldav.autoSyncMinutes))
					.onChange(async (value) => {
						caldav.autoSyncMinutes = Number(value);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.caldavRange'))
			.setDesc(this.t('settings.caldavRangeDesc'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption('0', this.t('settings.caldavRangeCurrent'))
					.addOption('1', this.t('settings.caldavRangeOne'))
					.addOption('3', this.t('settings.caldavRangeThree'))
					.setValue(String(caldav.rangeMonths))
					.onChange(async (value) => {
						caldav.rangeMonths = Number(value);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.accounts'))
			.setDesc(
				this.plugin.credentials.secure
					? this.t('settings.caldavPasswordStored')
					: this.t('settings.caldavPasswordPlain'),
			)
			.addButton((button) =>
				button
					.setButtonText(this.t('settings.caldavSyncNow'))
					.setCta()
					.onClick(async () => {
						await this.plugin.syncCalDav();
						this.display();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.caldavImport'))
			.setDesc(this.t('settings.caldavImportDesc'))
			.addButton((button) =>
				button.setButtonText(this.t('settings.caldavImport')).onClick(async () => {
					const summary = await this.plugin.importFullCalendarAccounts();
					const total = summary.imported + summary.updated;
					if (total === 0) {
						new Notice(this.t('notice.caldavImportNone'));
					} else {
						new Notice(
							this.t('notice.caldavImportOk', {
								count: total,
								passwords: summary.passwords,
							}),
						);
					}
					this.display();
				}),
			);

		for (const account of caldav.accounts) {
			this.renderCalDavAccount(container, account);
		}

		new Setting(container).addButton((button) =>
			button
				.setButtonText(this.t('settings.addAccount'))
				.onClick(async () => {
					caldav.accounts.push({
						id: `caldav_${Date.now()}`,
						name: this.t('settings.accountName'),
						url: '',
						username: '',
						password: '',
						color: '#6b7fd7',
						authMethod: 'basic',
						calendars: [],
					});
					await this.plugin.saveSettings();
					this.display();
				}),
		);
	}

	/** One account: its credentials, its calendars and its last sync. */
	private renderCalDavAccount(container: HTMLElement, account: CalDavAccount): void {
		new Setting(container)
			.setName(account.name || account.url || this.t('settings.accountName'))
			.setDesc(account.url);

		new Setting(container)
			.setName(this.t('settings.accountName'))
			.addText((text) =>
				text
					.setPlaceholder(this.t('settings.accountName'))
					.setValue(account.name)
					.onChange(async (value) => {
						account.name = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.serverUrl'))
			.setDesc('https://example.com/dav/')
			.addText((text) =>
				text
					.setPlaceholder('https://example.com/dav/')
					.setValue(account.url)
					.onChange(async (value) => {
						account.url = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.username'))
			.addText((text) =>
				text
					.setPlaceholder('me@example.com')
					.setValue(account.username)
					.onChange(async (value) => {
						account.username = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.password'))
			.setDesc(this.t('settings.caldavPasswordStored'))
			.addText((text) => {
				text.inputEl.type = 'password';
				let pending = account.password;
				text
					.setPlaceholder('••••••••')
					.setValue(account.password)
					.onChange((value) => {
						pending = value;
					});
				// The password is written when the field is left, not on every
				// keystroke — the credential store is not a text field.
				text.inputEl.addEventListener('blur', () => {
					if (pending === account.password) return;
					void this.plugin.setCalDavPassword(account, pending);
				});
			});

		new Setting(container)
			.setName(this.t('settings.caldavAuthMethod'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption('basic', this.t('settings.caldavAuthBasic'))
					.addOption('digest', this.t('settings.caldavAuthDigest'))
					.setValue(account.authMethod)
					.onChange(async (value) => {
						account.authMethod = value === 'digest' ? 'digest' : 'basic';
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.caldavTest'))
			.addButton((button) =>
				button.setButtonText(this.t('settings.caldavTest')).onClick(async () => {
					await this.plugin.testCalDavAccount(account);
					this.display();
				}),
			)
			.addExtraButton((button) =>
				button
					.setIcon('trash')
					.setTooltip(this.t('settings.removeAccount'))
					.onClick(async () => {
						this.plugin.settings.caldav.accounts =
							this.plugin.settings.caldav.accounts.filter((item) => item.id !== account.id);
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		if (account.lastError) {
			new Setting(container).setDesc(this.t('settings.caldavError', { message: account.lastError }));
		} else if (account.lastSyncAt) {
			new Setting(container).setDesc(
				this.t('settings.caldavLastSync', {
					time: new Date(account.lastSyncAt).toLocaleString(),
				}),
			);
		}

		new Setting(container)
			.setName(this.t('settings.caldavCalendars'))
			.setDesc(this.t('settings.caldavCalendarsDesc'));

		const calendars = account.calendars ?? [];
		if (calendars.length === 0) {
			new Setting(container).setDesc(this.t('settings.caldavNoCalendars'));
		}
		for (const calendar of calendars) {
			new Setting(container)
				.setName(calendar.name)
				.addToggle((toggle) =>
					toggle.setValue(calendar.selected).onChange(async (value) => {
						calendar.selected = value;
						await this.plugin.saveSettings();
					}),
				);
		}
	}

	private renderFolderFilters(container: HTMLElement, scope: 'frontmatter' | 'filenames' | 'tasks'): void {
		const target = this.plugin.settings[scope];

		new Setting(container)
			.setName(this.t('settings.includeFolders'))
			.setDesc(this.t('settings.includeFoldersDesc'))
			.addText((text) =>
				text
					.setPlaceholder('Folder/Subfolder')
					.setValue(target.include.join(', '))
					.onChange(async (value) => {
						target.include = splitList(value).map(normaliseFolder).filter(Boolean);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(container)
			.setName(this.t('settings.excludeFolders'))
			.setDesc(this.t('settings.excludeFoldersDesc'))
			.addText((text) =>
				text
					.setPlaceholder('Folder/Private')
					.setValue(target.exclude.join(', '))
					.onChange(async (value) => {
						target.exclude = splitList(value).map(normaliseFolder).filter(Boolean);
						await this.plugin.saveSettings();
					}),
			);
	}
}

function splitList(value: string): string[] {
	return value
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
}

function capitalise(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}
