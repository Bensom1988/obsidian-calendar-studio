/**
 * A `fetch` implementation on top of Obsidian's `requestUrl`.
 *
 * The renderer of Obsidian is a browser: a request to another origin needs
 * the headers a browser asks for, and a CalDAV server does not send them —
 * the request dies with "Failed to fetch". `requestUrl` goes through the
 * main process and skips those browser rules, which is what the CalDAV
 * client needs.
 *
 * The module is kept apart from the client so that the client stays free
 * of Obsidian imports and can be tested without an Obsidian runtime.
 */

import { requestUrl } from 'obsidian';

/** Turn the different header shapes into a plain record. */
function toHeaderRecord(headers: unknown): Record<string, string> {
	const record: Record<string, string> = {};
	if (!headers) return record;
	if (typeof Headers !== 'undefined' && headers instanceof Headers) {
		headers.forEach((value, key) => {
			record[key] = value;
		});
		return record;
	}
	if (Array.isArray(headers)) {
		for (const pair of headers) {
			if (Array.isArray(pair) && pair.length >= 2) record[String(pair[0])] = String(pair[1]);
		}
		return record;
	}
	for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
		if (value === undefined || value === null) continue;
		record[key] = String(value);
	}
	return record;
}

/** A rejection that looks like the one of an aborted `fetch`. */
function abortError(): Error {
	if (typeof DOMException === 'function') {
		return new DOMException('The operation was aborted.', 'AbortError');
	}
	const error = new Error('The operation was aborted.');
	error.name = 'AbortError';
	return error;
}

/**
 * A `fetch` that asks Obsidian for the request.
 *
 * Only what the CalDAV client needs is supported: a URL, a method, headers,
 * a text body and an abort signal.
 */
export function createObsidianFetch(): typeof fetch {
	return (async (input: RequestInfo | URL, init: RequestInit = {}) => {
		const url =
			typeof input === 'string'
				? input
				: input instanceof URL
					? input.href
					: String((input as Request).url ?? '');
		const method = (init.method ?? 'GET').toUpperCase();
		const headers = toHeaderRecord(init.headers);
		const body = typeof init.body === 'string' ? init.body : undefined;

		const pending = requestUrl({ url, method, headers, body, throw: false });
		const signal = init.signal ?? undefined;

		const response = signal
			? await Promise.race([
					pending,
					new Promise<never>((_, reject) => {
						if (signal.aborted) {
							reject(abortError());
							return;
						}
						signal.addEventListener('abort', () => reject(abortError()), { once: true });
					}),
				])
			: await pending;

		const text = response.text ?? '';
		const status = response.status ?? 200;
		// A response without a body may not carry one.
		const empty = status === 204 || status === 205 || status === 304;
		return new Response(empty ? null : text, {
			status,
			headers: toHeaderRecord(response.headers),
		});
	}) as typeof fetch;
}
