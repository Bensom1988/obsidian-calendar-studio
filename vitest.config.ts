import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * The tests assert local wall-clock times ("a meeting at 09:30 in Shanghai"),
 * so the suite runs in a fixed time zone. Otherwise the same test would pass
 * on the author's laptop and fail on a CI runner in UTC.
 */
process.env.TZ = 'Asia/Shanghai';

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
