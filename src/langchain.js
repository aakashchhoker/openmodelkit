import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { OpenModelKit } from './client.js';

/**
 * Convert a LangChain tool definition to OpenAI function-calling format.
 * Accepts LangChain StructuredTool, plain objects, or OpenAI-format tools.
 */
function convertTool(t) {
  if (t.type === 'function' && t.function) return t;

  const schema = t.schema
    ? typeof t.schema.jsonSchema === 'function'
      ? t.schema.jsonSchema()
      : t.schema
    : {};

  return {
    type: 'function',
    function: {
      name: t.name,
      description: t.description || '',
      parameters: schema,
    },
  };
}

/**
 * Convert a LangChain BaseMessage to the { role, content, ... } format
 * expected by the open-source-models API.
 */
function formatMessage(msg) {
  const type = typeof msg._getType === 'function' ? msg._getType() : msg.type;

  switch (type) {
    case 'system':
      return { role: 'system', content: msg.content || '' };
    case 'human':
      return { role: 'user', content: msg.content || '' };
    case 'ai': {
      const out = { role: 'assistant', content: msg.content || '' };
      if (msg.tool_calls?.length) {
        out.tool_calls = msg.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        }));
      }
      return out;
    }
    case 'tool':
      return {
        role: 'tool',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        tool_call_id: msg.tool_call_id,
      };
    default:
      return { role: 'user', content: String(msg.content || '') };
  }
}

/**
 * Parse provider response into a LangChain AIMessage.
 */
function parseResponse(result) {
  const content = result?.data?.content ?? result?.content ?? '';
  const rawToolCalls = result?.data?.tool_calls ?? result?.tool_calls;

  if (rawToolCalls?.length) {
    const toolCalls = rawToolCalls.map((tc) => {
      const fn = tc.function || tc;
      return {
        id: tc.id || `call_${Math.random().toString(36).slice(2, 10)}`,
        name: fn.name,
        args: typeof fn.arguments === 'string' ? JSON.parse(fn.arguments) : fn.arguments || {},
        type: 'tool_call',
      };
    });

    return new AIMessage({
      content: content || '',
      tool_calls: toolCalls,
    });
  }

  return new AIMessage({ content });
}

/**
 * LangChain-compatible chat model backed by OpenModelKit.
 *
 * Usage:
 *   import { ChatOpenModelKit } from 'openmodelkit';
 *   const llm = new ChatOpenModelKit({ provider: 'ollama', model: 'gemma4', baseUrl: '...' });
 *   const bound = llm.bindTools([myTool]);
 *   const msg = await bound.invoke([{ role: 'user', content: 'hello' }]);
 */
export class ChatOpenModelKit extends BaseChatModel {
  static lc_name() {
    return 'ChatOpenModelKit';
  }

  /**
   * @param {object} fields
   * @param {string} fields.provider - e.g. 'ollama' or 'nvidia'
   * @param {string} fields.model - model id like 'gemma4'
   * @param {string} [fields.baseUrl] - API base URL
   * @param {string} [fields.apiKey]
   * @param {string} [fields.ollamaApiKey]
   * @param {string} [fields.nvidiaApiKey]
   * @param {number} [fields.timeoutMs]
   */
  constructor(fields = {}) {
    super(fields);
    this.provider = fields.provider || 'ollama';
    this.modelName = fields.model || fields.modelName || '';
    this.omk = new OpenModelKit({
      baseUrl: fields.baseUrl,
      provider: this.provider,
      apiKey: fields.apiKey,
      ollamaApiKey: fields.ollamaApiKey,
      nvidiaApiKey: fields.nvidiaApiKey,
      timeoutMs: fields.timeoutMs,
      fetch: fields.fetch,
    });
    this._tools = [];
  }

  _llmType() {
    return 'openmodelkit';
  }

  bindTools(tools, kwargs) {
    const bound = new ChatOpenModelKit({
      provider: this.provider,
      model: this.modelName,
      baseUrl: this.omk.config.baseUrl,
      apiKey: this.omk.config.ollamaApiKey || this.omk.config.nvidiaApiKey,
      ollamaApiKey: this.omk.config.ollamaApiKey,
      nvidiaApiKey: this.omk.config.nvidiaApiKey,
      timeoutMs: this.omk.config.timeoutMs,
    });
    bound._tools = tools.map(convertTool);
    return bound;
  }

  async _generate(messages, options, runManager) {
    const formatted = messages.map(formatMessage);

    const chatOpts = {
      provider: this.provider,
      model: this.modelName,
      messages: formatted,
    };

    if (this._tools.length) {
      chatOpts.tools = this._tools;
    }

    const result = await this.omk.chat(chatOpts);
    const aiMsg = parseResponse(result);

    return {
      generations: [
        {
          message: aiMsg,
          text: aiMsg.content || '',
        },
      ],
    };
  }
}
