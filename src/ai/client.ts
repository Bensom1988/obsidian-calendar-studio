/**
 * OpenAI-compatible chat completion client (defaults to DeepSeek API).
 *
 * Uses an injected `fetch` implementation so Obsidian's `requestUrl` adapter
 * can bypass renderer CORS restrictions in production while unit tests pass a
 * deterministic fake.
 */

export interface AiMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface AiClientConfig {
	/** Base URL such as `https://api.deepseek.com/v1`. */
	baseUrl: string;
	/** Model identifier such as `deepseek-chat`. */
	model: string;
	/** Bearer token read from Obsidian SecretStorage or an environment variable. */
	apiKey: string;
}

export interface AiClientLike {
	complete(messages: AiMessage[]): Promise<string>;
}

/** Build the `/chat/completions` endpoint URL from a base URL. */
export function buildChatCompletionsUrl(baseUrl: string): string {
	const trimmed = baseUrl.trim().replace(/\/+$/, '');
	if (!trimmed) return 'https://api.deepseek.com/v1/chat/completions';
	if (trimmed.endsWith('/chat/completions')) return trimmed;
	return `${trimmed}/chat/completions`;
}

/**
 * Resolve an API key from Obsidian's secret storage first, then from the
 * configured environment variable name on desktop if available.
 */
export function resolveAiApiKey(options: {
	secretKey?: string | null;
	envVarName?: string;
	env?: Record<string, string | undefined>;
}): string {
	if (options.secretKey && options.secretKey.trim()) {
		return options.secretKey.trim();
	}
	const envName = options.envVarName?.trim();
	if (envName) {
		const envSource =
			options.env ??
			(typeof process !== 'undefined' && process.env
				? (process.env as Record<string, string | undefined>)
				: undefined);
		const fromEnv = envSource?.[envName]?.trim();
		if (fromEnv) return fromEnv;
	}
	return '';
}

export function createAiClient(
	config: AiClientConfig,
	fetchImpl: typeof fetch = globalThis.fetch,
): AiClientLike {
	return {
		async complete(messages: AiMessage[]): Promise<string> {
			const apiKey = config.apiKey.trim();
			if (!apiKey) {
				throw new Error('Missing AI API key');
			}
			const url = buildChatCompletionsUrl(config.baseUrl);
			const model = config.model.trim() || 'deepseek-chat';
			const response = await fetchImpl(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model,
					messages,
					temperature: 0.3,
				}),
				signal: AbortSignal.timeout(60000),
			});

			if (!response.ok) {
				const detail = (await response.text().catch(() => '')).slice(0, 200);
				throw new Error(
					`AI request failed (${response.status}): ${detail || response.statusText}`,
				);
			}

			const payload = (await response.json()) as {
				choices?: Array<{ message?: { content?: string } }>;
			};
			const content = payload.choices?.[0]?.message?.content?.trim();
			if (!content) {
				throw new Error('AI response did not contain any message content');
			}
			return content;
		},
	};
}
