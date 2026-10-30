import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * The `obsidian` package ships types only, so unit tests alias it to a stub.
 * Everything else runs against the real source files.
 */
export default defineConfig({
	resolve: {
		alias: {
			obsidian: fileURLToPath(new URL('./tests/stubs/obsidian.ts', import.meta.url)),
		},
	},
	test: {
		include: ['tests/**/*.test.ts'],
	},
});
