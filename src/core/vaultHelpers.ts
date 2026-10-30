import { App, TFolder, normalizePath } from 'obsidian';

/**
 * Make sure a folder exists, creating every missing level.
 *
 * `vault.create` refuses to write into a folder that does not exist yet, so
 * every write path has to prepare its folder first.
 */
export async function ensureFolder(app: App, folderPath: string): Promise<void> {
	const path = normalizePath(folderPath.trim()).replace(/^\/+|\/+$/g, '');
	if (!path || path === '/') return;

	const parts = path.split('/');
	let current = '';
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		const existing = app.vault.getAbstractFileByPath(current);
		if (existing instanceof TFolder) continue;
		if (existing) return; // a file already sits here — nothing to create
		try {
			await app.vault.createFolder(current);
		} catch (error) {
			// Another run may have created it in the meantime.
			const now = app.vault.getAbstractFileByPath(current);
			if (!(now instanceof TFolder)) throw error;
		}
	}
}
