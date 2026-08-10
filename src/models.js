import { OpenModelKit } from './client.js';

/**
 * List models for a provider.
 * @param {import('./types.js').ListModelsOptions & import('./types.js').OpenModelKitOptions} [opts]
 */
export function listModels(opts = {}) {
  return new OpenModelKit(opts).listModels(opts);
}

/**
 * List API providers.
 * @param {import('./types.js').OpenModelKitOptions} [opts]
 */
export function listProviders(opts = {}) {
  return new OpenModelKit(opts).listProviders();
}
