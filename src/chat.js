import { OpenModelKit } from './client.js';

/**
 * One-shot chat.
 * @param {import('./types.js').ChatOptions & import('./types.js').OpenModelKitOptions} opts
 */
export function chat(opts = {}) {
  return new OpenModelKit(opts).chat(opts);
}
