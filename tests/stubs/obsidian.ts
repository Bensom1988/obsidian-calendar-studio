/**
 * A tiny stand-in for the `obsidian` module.
 *
 * The published package only ships type definitions, so unit tests alias
 * `obsidian` to this file. It covers the few runtime values the pure helpers
 * touch: path normalisation and the two file classes used with `instanceof`.
 */

export class TFile {
	path = '';
	basename = '';
	extension = 'md';
	stat = { mtime: 0, size: 0 };
}

export class TFolder {
	path = '';
	children: unknown[] = [];
}

export class App {}
export class Plugin {}
export class PluginSettingTab {}
export class ItemView {}
export class WorkspaceLeaf {}
export class Setting {}
export class Notice {}
export class Modal {}
export class MarkdownRenderChild {
	constructor(public containerEl: unknown) {}
	onload(): void {}
	onunload(): void {}
}
export class Plugin_ {}
export const Platform = { isMobile: false, isDesktop: true };

export function normalizePath(path: string): string {
	return path
		.replace(/([\\/])+/g, '/')
		.replace(/(^\/|\/$)/g, '')
		.replace(/ /g, ' ')
		.trim();
}
