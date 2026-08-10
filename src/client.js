import { resolveConfig, parseModelRef } from './config.js';

export class OpenModelKitError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, code?: string, body?: unknown, cause?: unknown }} [meta]
   */
  constructor(message, meta = {}) {
    super(message, meta.cause !== undefined ? { cause: meta.cause } : undefined);
    this.name = 'OpenModelKitError';
    this.status = meta.status;
    this.code = meta.code || (meta.status != null ? `HTTP_${meta.status}` : 'REQUEST_FAILED');
    this.body = meta.body;
  }
}

/**
 * @param {AbortSignal | undefined} userSignal
 * @param {number} timeoutMs
 */
function withTimeout(userSignal, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onUserAbort = () => controller.abort();
  if (userSignal) {
    if (userSignal.aborted) controller.abort();
    else userSignal.addEventListener('abort', onUserAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      userSignal?.removeEventListener?.('abort', onUserAbort);
    },
  };
}

export class OpenModelKit {
  /**
   * @param {import('./types.js').OpenModelKitOptions} [options]
   */
  constructor(options = {}) {
    try {
      this.config = resolveConfig(options);
    } catch (err) {
      throw new OpenModelKitError(err?.message || String(err), {
        code: 'INVALID_CONFIG',
        cause: err,
      });
    }
    this.fetchFn = options.fetch || globalThis.fetch;
    if (typeof this.fetchFn !== 'function') {
      throw new OpenModelKitError(
        'fetch is not available. Use Node.js 18+ or pass options.fetch.',
        { code: 'NO_FETCH' }
      );
    }
  }

  /** @param {string} provider */
  #authHeaders(provider) {
    /** @type {Record<string, string>} */
    const headers = { Accept: 'application/json' };
    if (provider === 'nvidia') {
      if (this.config.nvidiaApiKey) headers['X-NVIDIA-API-Key'] = this.config.nvidiaApiKey;
    } else if (this.config.ollamaApiKey) {
      headers['X-API-Key'] = this.config.ollamaApiKey;
    }
    return headers;
  }

  /**
   * @param {string} path
   * @param {RequestInit & { provider?: string }} [init]
   */
  async #request(path, init = {}) {
    const { provider = this.config.provider, signal: userSignal, ...fetchInit } = init;
    const url = `${this.config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const { signal, cleanup } = withTimeout(userSignal, this.config.timeoutMs);

    try {
      const res = await this.fetchFn(url, {
        ...fetchInit,
        headers: {
          ...this.#authHeaders(provider),
          ...(fetchInit.headers || {}),
        },
        signal,
      });

      const text = await res.text();
      let body = null;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }

      if (!res.ok) {
        const msg =
          (body &&
            typeof body === 'object' &&
            (/** @type {{ error?: string, message?: string }} */ (body).error ||
              /** @type {{ message?: string }} */ (body).message)) ||
          `Request failed (${res.status})`;
        throw new OpenModelKitError(String(msg), {
          status: res.status,
          body,
          code: `HTTP_${res.status}`,
        });
      }

      return body;
    } catch (err) {
      if (err instanceof OpenModelKitError) throw err;
      if (err?.name === 'AbortError') {
        throw new OpenModelKitError(`Request timed out after ${this.config.timeoutMs}ms`, {
          status: 408,
          code: 'TIMEOUT',
          cause: err,
        });
      }
      throw new OpenModelKitError(err?.message || String(err), {
        code: 'NETWORK_ERROR',
        cause: err,
      });
    } finally {
      cleanup();
    }
  }

  /** List registered providers. */
  listProviders() {
    return this.#request('/providers', { method: 'GET' });
  }

  /**
   * @param {import('./types.js').ListModelsOptions} [opts]
   */
  async listModels(opts = {}) {
    const provider = String(opts.provider || this.config.provider)
      .trim()
      .toLowerCase();
    if (!provider) {
      throw new OpenModelKitError('provider is required', { code: 'INVALID_INPUT' });
    }

    const params = new URLSearchParams();
    if (opts.free === true) params.set('free', 'true');
    if (opts.premium === true) params.set('premium', 'true');
    if (opts.page != null) params.set('page', String(opts.page));
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.q) params.set('q', String(opts.q));
    if (opts.category) params.set('category', String(opts.category));
    if (opts.order) params.set('order', String(opts.order));

    const qs = params.toString();
    return this.#request(`/${provider}/models${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      provider,
    });
  }

  /**
   * @param {import('./types.js').ChatOptions} opts
   */
  async chat(opts = {}) {
    const modelRaw = opts.model != null ? String(opts.model).trim() : '';
    const prompt = opts.prompt != null ? String(opts.prompt) : '';
    if (!modelRaw) throw new OpenModelKitError('model is required', { code: 'INVALID_INPUT' });
    if (!prompt) throw new OpenModelKitError('prompt is required', { code: 'INVALID_INPUT' });

    const { provider, model } = parseModelRef(
      modelRaw,
      opts.provider || this.config.provider
    );
    if (!model) throw new OpenModelKitError('model is required', { code: 'INVALID_INPUT' });

    /** @type {Record<string, unknown>} */
    const body = {
      model,
      prompt,
      ...(opts.options && typeof opts.options === 'object' && !Array.isArray(opts.options)
        ? opts.options
        : {}),
    };

    for (const key of ['stream', 'temperature', 'max_tokens', 'system', 'messages']) {
      if (opts[key] !== undefined && body[key] === undefined) body[key] = opts[key];
    }

    return this.#request(`/${provider}/chat`, {
      method: 'POST',
      provider,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
}
