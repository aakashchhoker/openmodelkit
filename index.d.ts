export type ProviderId = 'ollama' | 'nvidia' | (string & {});

export interface OpenModelKitOptions {
  baseUrl?: string;
  provider?: ProviderId;
  /** Generic key: Ollama, or NVIDIA when it starts with `nvapi-`. */
  apiKey?: string;
  ollamaApiKey?: string;
  nvidiaApiKey?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface ListModelsOptions {
  provider?: ProviderId;
  free?: boolean;
  premium?: boolean;
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  order?: string;
}

export interface ChatOptions {
  model: string;
  prompt: string;
  provider?: ProviderId;
  /** Extra fields merged into the chat request body. */
  options?: Record<string, unknown>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  system?: string;
  messages?: unknown;
}

export interface ModelRef {
  provider: ProviderId;
  model: string;
}

export interface OpenModelKitConfig {
  baseUrl: string;
  provider: ProviderId;
  ollamaApiKey: string;
  nvidiaApiKey: string;
  timeoutMs: number;
}

export declare class OpenModelKitError extends Error {
  readonly name: 'OpenModelKitError';
  readonly status?: number;
  readonly code: string;
  readonly body?: unknown;
  constructor(
    message: string,
    meta?: { status?: number; code?: string; body?: unknown; cause?: unknown }
  );
}

export declare class OpenModelKit {
  readonly config: OpenModelKitConfig;
  constructor(options?: OpenModelKitOptions);
  listProviders(): Promise<unknown>;
  listModels(opts?: ListModelsOptions): Promise<unknown>;
  chat(opts: ChatOptions): Promise<unknown>;
}

export declare function chat(
  opts: ChatOptions & OpenModelKitOptions
): Promise<unknown>;

export declare function listModels(
  opts?: ListModelsOptions & OpenModelKitOptions
): Promise<unknown>;

export declare function listProviders(
  opts?: OpenModelKitOptions
): Promise<unknown>;

export declare function resolveConfig(
  opts?: OpenModelKitOptions
): OpenModelKitConfig;

export declare function parseModelRef(
  raw: string,
  fallbackProvider?: ProviderId
): ModelRef;

export declare const DEFAULT_BASE_URL: string;
export declare const DEFAULT_PROVIDER: string;
