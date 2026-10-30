// Copies the built plugin into a local vault for development.
//
//   VAULT_PATH="/path/to/vault" npm run deploy
//
// The destination is <vault>/.obsidian/plugins/calendar-studio. The plugin is
// also enabled in community-plugins.json if that file exists.

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const vaultPath = process.env.VAULT_PATH;
if (!vaultPath) {
	console.error('VAULT_PATH is not set.\nUsage: VAULT_PATH="/path/to/vault" npm run deploy');
	process.exit(1);
}

const pluginId = 'calendar-studio';
// fileURLToPath — not URL.pathname — otherwise non-ASCII paths get percent-encoded.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const vault = resolve(vaultPath);
const target = join(vault, '.obsidian', 'plugins', pluginId);

if (!existsSync(join(vault, '.obsidian'))) {
	console.error(`Not an Obsidian vault (no .obsidian folder): ${vault}`);
	process.exit(1);
}

mkdirSync(target, { recursive: true });

for (const file of ['main.js', 'manifest.json', 'styles.css']) {
	const src = join(root, file);
	if (!existsSync(src)) {
		console.error(`Missing build artifact: ${file} — run \`npm run build\` first.`);
		process.exit(1);
	}
	copyFileSync(src, join(target, file));
	console.log(`deployed ${file}`);
}

// Enable the plugin in the vault's community plugin list.
const listPath = join(vault, '.obsidian', 'community-plugins.json');
if (existsSync(listPath)) {
	try {
		const list = JSON.parse(readFileSync(listPath, 'utf8'));
		if (!Array.isArray(list)) throw new Error('not an array');
		if (!list.includes(pluginId)) {
			list.push(pluginId);
			writeFileSync(listPath, `${JSON.stringify(list, null, '\t')}\n`);
			console.log(`enabled ${pluginId} in community-plugins.json`);
		} else {
			console.log(`${pluginId} already enabled`);
		}
	} catch (err) {
		console.warn(`Could not update community-plugins.json: ${err.message}`);
	}
}

console.log(`\nDone → ${target}`);
console.log('Reload Obsidian (Cmd/Ctrl + P → "Reload app without saving") to activate.');
