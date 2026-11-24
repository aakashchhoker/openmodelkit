/** @typedef {'ollama' | 'nvidia' | string} ProviderId */

/** Public HTTPS API (Vercel → Oracle). Override with OPENMODELKIT_BASE_URL. */
export const DEFAULT_BASE_URL =
  process.env.OPENMODELKIT_BASE_URL?.trim() ||
  process.env.OPEN_SOURCE_MODELS_URL?.trim() ||
  'https://arix-ten.vercel.app/backend';

export const DEFAULT_PROVIDER = (
  process.env.OPENMODELKIT_PROVIDER ||
  process.env.DEFAULT_PROVIDER ||
  'nvidia'
)
  .trim()
  .toLowerCase();

/** Default NVIDIA chat model when callers omit -m / model. */
export const DEFAULT_MODEL = (
  process.env.OPENMODELKIT_MODEL ||
  process.env.NVIDIA_MODEL ||
  'minimaxai/minimax-m3.1-flash'
).trim();

/**
 * @param {unknown} value
 * @param {number} fallback
 */
function toPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * @param {string} raw
 */
function normalizeBaseUrl(raw) {
  const value = String(raw || '').trim().replace(/\/$/, '');
  if (!value) {
    throw new Error('baseUrl is required');
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid baseUrl: ${value}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`baseUrl must be http(s): ${value}`);
  }
  return value;
}

/**
 * @param {object} [opts]
 */
export function resolveConfig(opts = {}) {
  const provider = String(opts.provider || DEFAULT_PROVIDER)
    .trim()
    .toLowerCase();

  const apiKey = opts.apiKey != null ? String(opts.apiKey).trim() : '';
  const ollamaFromEnv = (
    process.env.OLLAMA_API_KEY ||
    process.env.OPENMODELKIT_OLLAMA_API_KEY ||
    ''
  ).trim();
  const nvidiaFromEnv = (
    process.env.NVIDIA_API_KEY ||
    process.env.OPENMODELKIT_NVIDIA_API_KEY ||
    ''
  ).trim();

  // Generic apiKey maps by shape: nvapi-* -> NVIDIA, anything else -> Ollama.
  const isNvidiaKey = apiKey.startsWith('nvapi-');
  const mappedGenericOllama = apiKey && !isNvidiaKey ? apiKey : '';
  const mappedGenericNvidia = isNvidiaKey ? apiKey : '';

  // Precedence: explicit per-provider option > generic apiKey > env default.
  const ollamaApiKey =
    String(opts.ollamaApiKey || '').trim() || mappedGenericOllama || ollamaFromEnv;
  const nvidiaApiKey =
    String(opts.nvidiaApiKey || '').trim() || mappedGenericNvidia || nvidiaFromEnv;

  return {
    baseUrl: normalizeBaseUrl(opts.baseUrl || DEFAULT_BASE_URL),
    provider,
    ollamaApiKey,
    nvidiaApiKey,
    timeoutMs: toPositiveInt(
      opts.timeoutMs ?? process.env.OPENMODELKIT_TIMEOUT_MS,
      120_000
    ),
  };
}

/**
 * Parse `nvidia:meta/...` or `ollama:gemma4` model refs.
 * @param {string} raw
 * @param {string} [fallbackProvider]
 */
export function parseModelRef(raw, fallbackProvider = DEFAULT_PROVIDER) {
  const value = String(raw || '').trim();
  const fallback =
    String(fallbackProvider || DEFAULT_PROVIDER).trim().toLowerCase() ||
    'nvidia';
  if (!value) return { provider: fallback, model: '' };

  const colon = value.match(/^([a-z0-9_-]+):(.+)$/i);
  if (colon) {
    const id = colon[1].toLowerCase();
    if (id === 'ollama' || id === 'nvidia') {
      return { provider: id, model: colon[2].trim() };
    }
  }

  return { provider: fallback, model: value };
}
