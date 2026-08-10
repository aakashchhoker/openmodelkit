/**
 * Shared JSDoc typedefs (runtime no-op). Types for consumers live in index.d.ts.
 * @typedef {object} OpenModelKitOptions
 * @property {string} [baseUrl]
 * @property {string} [provider]
 * @property {string} [apiKey]
 * @property {string} [ollamaApiKey]
 * @property {string} [nvidiaApiKey]
 * @property {number} [timeoutMs]
 * @property {typeof fetch} [fetch]
 *
 * @typedef {object} ListModelsOptions
 * @property {string} [provider]
 * @property {boolean} [free]
 * @property {boolean} [premium]
 * @property {number} [page]
 * @property {number} [limit]
 * @property {string} [q]
 * @property {string} [category]
 * @property {string} [order]
 *
 * @typedef {object} ChatOptions
 * @property {string} model
 * @property {string} prompt
 * @property {string} [provider]
 * @property {Record<string, unknown>} [options]
 * @property {boolean} [stream]
 * @property {number} [temperature]
 * @property {number} [max_tokens]
 * @property {string} [system]
 * @property {unknown} [messages]
 */

export {};
