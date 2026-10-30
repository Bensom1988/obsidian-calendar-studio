/**
 * Credentials of the CalDAV accounts.
 *
 * A vault is often synced through iCloud or Dropbox — a password written into
 * the settings file would travel along with it in plain text. Obsidian's
 * secret storage keeps it in the operating system's credential store
 * instead, and the settings file only remembers that *a* password exists.
 *
 * Obsidian gained the secret storage in 1.11.4. On older versions the
 * password falls back to the settings file; the settings tab says so.
 */

import type { App } from 'obsidian';

/** Prefix of the secret ids the plugin owns. */
export const SECRET_PREFIX = 'calendar-studio-caldav-';

/** Turn an account id into a valid secret id (lowercase, dashes). */
export function secretId(accountId: string): string {
	const cleaned = accountId
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return `${SECRET_PREFIX}${cleaned || 'default'}`;
}

export class CredentialStore {
	constructor(private app: App) {}

	/** Whether this Obsidian version can keep secrets out of the vault. */
	get secure(): boolean {
		const storage = (this.app as unknown as { secretStorage?: { setSecret?: unknown } })
			.secretStorage;
		return typeof storage?.setSecret === 'function';
	}

	/** The password of an account, or `null` when there is none. */
	get(accountId: string): string | null {
		if (!this.secure) return null;
		try {
			return this.app.secretStorage.getSecret(secretId(accountId));
		} catch {
			return null;
		}
	}

	/**
	 * Store the password of an account.
	 *
	 * Returns `false` when the vault cannot keep secrets — the caller then
	 * keeps the password in the settings file.
	 */
	set(accountId: string, password: string): boolean {
		if (!this.secure) return false;
		try {
			this.app.secretStorage.setSecret(secretId(accountId), password);
			return true;
		} catch {
			return false;
		}
	}

	/** Forget the password of an account. */
	remove(accountId: string): void {
		if (!this.secure) return;
		try {
			this.app.secretStorage.setSecret(secretId(accountId), '');
		} catch {
			/* nothing to do */
		}
	}
}
