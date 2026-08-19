import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenModelKit, convertTool } from '../src/langchain.js';

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

describe('convertTool', () => {
  it('passes through OpenAI-format tools', () => {
    const tool = {
      type: 'function',
      function: { name: 'ping', description: 'ping', parameters: { type: 'object' } },
    };
    assert.equal(convertTool(tool), tool);
  });

  it('wraps a plain name/description/schema tool', () => {
    const out = convertTool({
      name: 'get_weather',
      description: 'Weather lookup',
      schema: { type: 'object', properties: { city: { type: 'string' } } },
    });
    assert.equal(out.type, 'function');
    assert.equal(out.function.name, 'get_weather');
    assert.equal(out.function.parameters.properties.city.type, 'string');
  });
});

describe('ChatOpenModelKit', () => {
  it('POSTs ollama chat with prompt + messages and unwraps data.content', async () => {
    const fetch = okFetch(async () => ({
      body: { success: true, data: { content: 'hello from ollama' } },
    }));

    const llm = new ChatOpenModelKit({
      baseUrl: 'http://api.test',
      provider: 'ollama',
      model: 'gemma4',
      apiKey: 'ollama-key',
      fetch,
    });

    const msg = await llm.invoke([new HumanMessage('Say hi')]);
    assert.equal(msg.content, 'hello from ollama');

    const [url, init] = fetch.mock.calls[0].arguments;
    assert.equal(url, 'http://api.test/ollama/chat');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['X-API-Key'], 'ollama-key');
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'gemma4');
    assert.equal(body.prompt, 'Say hi');
    assert.equal(body.messages.at(-1).role, 'user');
    assert.equal(body.messages.at(-1).content, 'Say hi');
  });

  it('POSTs nvidia chat with X-NVIDIA-API-Key for a free chat model', async () => {
    const fetch = okFetch(async () => ({
      body: { success: true, data: { content: 'Hello, how are you.' } },
    }));

    const llm = new ChatOpenModelKit({
      baseUrl: 'http://api.test',
      provider: 'nvidia',
      model: 'meta/llama-3.1-8b-instruct',
      nvidiaApiKey: 'nvapi-test',
      fetch,
    });

    const msg = await llm.invoke([new HumanMessage('Say hi in 3 words')]);
    assert.equal(msg.content, 'Hello, how are you.');

    const [url, init] = fetch.mock.calls[0].arguments;
    assert.equal(url, 'http://api.test/nvidia/chat');
    assert.equal(init.headers['X-NVIDIA-API-Key'], 'nvapi-test');
    assert.equal(init.headers['X-API-Key'], undefined);
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'meta/llama-3.1-8b-instruct');
    assert.equal(body.prompt, 'Say hi in 3 words');
  });

  it('bindTools keeps nvidia auth and sends OpenAI-format tools', async () => {
    const fetch = okFetch(async () => ({
      body: {
        success: true,
        data: {
          content: '',
          tool_calls: [
            {
              id: 'call_1',
              function: { name: 'get_weather', arguments: '{"city":"Paris"}' },
            },
          ],
        },
      },
    }));

    const llm = new ChatOpenModelKit({
      baseUrl: 'http://api.test',
      provider: 'nvidia',
      model: 'meta/llama-3.1-8b-instruct',
      nvidiaApiKey: 'nvapi-test',
      fetch,
    }).bindTools([
      {
        name: 'get_weather',
        description: 'Get weather',
        schema: { type: 'object', properties: { city: { type: 'string' } } },
      },
    ]);

    const msg = await llm.invoke([
      new SystemMessage('Use tools when needed.'),
      new HumanMessage('Weather in Paris?'),
    ]);

    assert.ok(msg instanceof AIMessage);
    assert.equal(msg.tool_calls[0].name, 'get_weather');
    assert.deepEqual(msg.tool_calls[0].args, { city: 'Paris' });

    const [url, init] = fetch.mock.calls[0].arguments;
    assert.equal(url, 'http://api.test/nvidia/chat');
    assert.equal(init.headers['X-NVIDIA-API-Key'], 'nvapi-test');
    const body = JSON.parse(init.body);
    assert.equal(body.tools[0].type, 'function');
    assert.equal(body.tools[0].function.name, 'get_weather');
    assert.equal(body.prompt, 'Weather in Paris?');
  });

  it('surfaces provider HTTP errors', async () => {
    const llm = new ChatOpenModelKit({
      baseUrl: 'http://api.test',
      provider: 'nvidia',
      model: 'meta/llama-3.1-8b-instruct',
      nvidiaApiKey: 'nvapi-test',
      fetch: async () => ({
        ok: false,
        status: 502,
        async text() {
          return JSON.stringify({ error: 'NVIDIA API error: 404 page not found\n' });
        },
      }),
    });

    await assert.rejects(
      () => llm.invoke([new HumanMessage('hi')]),
      /404 page not found/
    );
  });
});
