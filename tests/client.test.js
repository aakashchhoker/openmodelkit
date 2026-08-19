import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { OpenModelKit, OpenModelKitError } from '../src/client.js';
import { chat } from '../src/chat.js';
import { listModels, listProviders } from '../src/models.js';
import { parseModelRef, resolveConfig } from '../src/config.js';
import { parseArgs } from '../src/cli.js';

function okFetch(handler) {
  return mock.fn(async (url, init) => {
    const result = await handler(String(url), init);
    return {
      ok: result.ok !== false,
      status: result.status ?? 200,
      async text() {
        return typeof result.body === 'string'
          ? result.body
          : JSON.stringify(result.body ?? { ok: true });
      },
    };
  });
}

describe('parseModelRef', () => {
  it('parses nvidia: and ollama: prefixes', () => {
    assert.deepEqual(parseModelRef('nvidia:meta/llama-3.1-8b-instruct'), {
      provider: 'nvidia',
      model: 'meta/llama-3.1-8b-instruct',
    });
    assert.deepEqual(parseModelRef('ollama:gemma4', 'nvidia'), {
      provider: 'ollama',
      model: 'gemma4',
    });
  });

  it('uses fallback without prefix', () => {
    assert.deepEqual(parseModelRef('gemma4', 'ollama'), {
      provider: 'ollama',
      model: 'gemma4',
    });
  });
});

describe('resolveConfig', () => {
  it('rejects invalid baseUrl', () => {
    assert.throws(() => resolveConfig({ baseUrl: 'not-a-url' }), /Invalid baseUrl/);
    assert.throws(() => resolveConfig({ baseUrl: 'ftp://x' }), /http\(s\)/);
  });

  it('strips trailing slash and maps nvapi- apiKey', () => {
    const cfg = resolveConfig({
      baseUrl: 'http://localhost:3000/',
      apiKey: 'nvapi-abc',
      provider: 'nvidia',
    });
    assert.equal(cfg.baseUrl, 'http://localhost:3000');
    assert.equal(cfg.nvidiaApiKey, 'nvapi-abc');
    assert.equal(cfg.ollamaApiKey, '');
  });

  it('lets user-provided apiKey override env defaults', () => {
    const prevO = process.env.OLLAMA_API_KEY;
    const prevN = process.env.NVIDIA_API_KEY;
    process.env.OLLAMA_API_KEY = 'env-ollama';
    process.env.NVIDIA_API_KEY = 'nvapi-env';
    try {
      const a = resolveConfig({
        baseUrl: 'http://localhost:3000',
        provider: 'ollama',
        apiKey: 'user-ollama',
      });
      assert.equal(a.ollamaApiKey, 'user-ollama');

      const b = resolveConfig({
        baseUrl: 'http://localhost:3000',
        provider: 'nvidia',
        apiKey: 'nvapi-user',
      });
      assert.equal(b.nvidiaApiKey, 'nvapi-user');
    } finally {
      if (prevO === undefined) delete process.env.OLLAMA_API_KEY;
      else process.env.OLLAMA_API_KEY = prevO;
      if (prevN === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = prevN;
    }
  });
});

describe('parseArgs', () => {
  it('parses models and chat flags', () => {
    const a = parseArgs(['models', '--provider', 'nvidia', '--free', '--json']);
    assert.equal(a.positional[0], 'models');
    assert.equal(a.flags.provider, 'nvidia');
    assert.equal(a.flags.free, true);

    const b = parseArgs(['chat', '-m', 'gemma4', 'what', 'is', '2+2']);
    assert.equal(b.flags.model, 'gemma4');
    assert.deepEqual(b.positional.slice(1), ['what', 'is', '2+2']);
  });

  it('errors on missing flag values', () => {
    assert.throws(() => parseArgs(['chat', '-m']), /Missing value/);
  });
});

describe('OpenModelKit HTTP client', () => {
  it('listModels builds URL, auth, and does not leak provider into fetch init', async () => {
    const fetch = okFetch(async () => ({ body: { models: [] } }));
    const kit = new OpenModelKit({
      baseUrl: 'http://api.test',
      provider: 'ollama',
      apiKey: 'secret-key',
      fetch,
    });

    await kit.listModels({ free: true, page: 2 });

    const [url, init] = fetch.mock.calls[0].arguments;
    assert.equal(url, 'http://api.test/ollama/models?free=true&page=2');
    assert.equal(init.method, 'GET');
    assert.equal(init.headers['X-API-Key'], 'secret-key');
    assert.equal('provider' in init, false);
  });

  it('nvidia listModels uses X-NVIDIA-API-Key', async () => {
    const fetch = okFetch(async () => ({ body: {} }));
    const kit = new OpenModelKit({
      baseUrl: 'http://api.test',
      provider: 'nvidia',
      nvidiaApiKey: 'nvapi-test',
      fetch,
    });

    await kit.listModels({ premium: true });
    const [url, init] = fetch.mock.calls[0].arguments;
    assert.equal(url, 'http://api.test/nvidia/models?premium=true');
    assert.equal(init.headers['X-NVIDIA-API-Key'], 'nvapi-test');
    assert.equal(init.headers['X-API-Key'], undefined);
  });

  it('chat POSTs body and resolves nvidia: prefix', async () => {
    const fetch = okFetch(async () => ({ body: { response: 'hi' } }));
    const kit = new OpenModelKit({
      baseUrl: 'http://api.test',
      provider: 'ollama',
      nvidiaApiKey: 'nvapi-x',
      fetch,
    });

    await kit.chat({
      model: 'nvidia:meta/llama-3.1-8b-instruct',
      prompt: 'hello',
    });

    const [url, init] = fetch.mock.calls[0].arguments;
    assert.equal(url, 'http://api.test/nvidia/chat');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['X-NVIDIA-API-Key'], 'nvapi-x');
    assert.deepEqual(JSON.parse(init.body), {
      model: 'meta/llama-3.1-8b-instruct',
      prompt: 'hello',
    });
  });

  it('listProviders hits GET /providers', async () => {
    const fetch = okFetch(async () => ({ body: { providers: [] } }));
    const kit = new OpenModelKit({ baseUrl: 'http://api.test', fetch });
    await kit.listProviders();
    const [url, init] = fetch.mock.calls[0].arguments;
    assert.equal(url, 'http://api.test/providers');
    assert.equal(init.method, 'GET');
  });

  it('throws OpenModelKitError on non-OK', async () => {
    const kit = new OpenModelKit({
      baseUrl: 'http://api.test',
      fetch: async () => ({
        ok: false,
        status: 401,
        async text() {
          return JSON.stringify({ error: 'unauthorized' });
        },
      }),
    });

    await assert.rejects(
      () => kit.chat({ model: 'gemma4', prompt: 'hi' }),
      (err) => {
        assert.ok(err instanceof OpenModelKitError);
        assert.equal(err.status, 401);
        assert.equal(err.code, 'HTTP_401');
        assert.match(err.message, /unauthorized/i);
        return true;
      }
    );
  });

  it('validates chat input', async () => {
    const kit = new OpenModelKit({
      baseUrl: 'http://api.test',
      fetch: async () => ({ ok: true, status: 200, async text() { return '{}'; } }),
    });
    await assert.rejects(() => kit.chat({ model: '', prompt: 'x' }), /model is required/);
    await assert.rejects(() => kit.chat({ model: 'm', prompt: '' }), /prompt is required/);
  });
});

describe('convenience exports', () => {
  it('chat / listModels / listProviders use injected fetch', async () => {
    const calls = [];
    const fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return { ok: true, status: 200, async text() { return '{"ok":true}'; } };
    };

    await chat({
      baseUrl: 'http://x',
      model: 'gemma4',
      prompt: 'hi',
      apiKey: 'k',
      fetch,
    });
    await listModels({ baseUrl: 'http://x', free: true, fetch });
    await listProviders({ baseUrl: 'http://x', fetch });

    assert.equal(calls[0].url, 'http://x/ollama/chat');
    assert.equal(calls[1].url, 'http://x/ollama/models?free=true');
    assert.equal(calls[2].url, 'http://x/providers');
  });
});
