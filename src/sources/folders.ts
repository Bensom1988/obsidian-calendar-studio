import type { FolderFilter } from '../core/types';

/** Normalise a user-entered folder: no leading/trailing slash. */
export function normaliseFolder(folder: string): string {
	return folder.trim().replace(/^\/+|\/+$/g, '');
}

/**
 * Folder matching for a source.
 *
 * `include` empty means "everywhere". `exclude` always wins over `include`.
 */
export function matchesFolder(path: string, filter: FolderFilter): boolean {
	const include = filter.include.map(normaliseFolder).filter(Boolean);
	const exclude = filter.exclude.map(normaliseFolder).filter(Boolean);

	if (include.length > 0) {
		const included = include.some(
			(folder) => path === folder || path.startsWith(`${folder}/`),
		);
		if (!included) return false;
	}
	if (exclude.length > 0) {
		const excluded = exclude.some(
			(folder) => path === folder || path.startsWith(`${folder}/`),
		);
		if (excluded) return false;
	}
	return true;
}
