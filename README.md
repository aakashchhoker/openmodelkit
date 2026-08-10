# OpenModelKit

[![npm version](https://img.shields.io/npm/v/openmodelkit.svg)](https://www.npmjs.com/package/openmodelkit)
[![Node.js](https://img.shields.io/node/v/openmodelkit.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

List open models, filter them, and chat — with a model name and a prompt.

Zero runtime dependencies. Works with **Ollama**, **NVIDIA** and many more. Includes a small **JS SDK** and **CLI**.

```bash
npm install openmodelkit
```

Requires **Node.js 18+**.

---

## Quick start

### 1. List free models

```js
import { listModels } from 'openmodelkit';

const { models } = await listModels({
  provider: 'ollama',
  free: true,
});

for (const model of models || []) {
  console.log(model.id || model.name);
}
```

### 2. Chat with a model

```js
import { chat } from 'openmodelkit';

const reply = await chat({
  provider: 'ollama',
  model: 'gemma4',
  prompt: 'Explain gravity in simple words',
});

console.log(reply);
```

### 3. Full flow (list → chat)

```js
import { listModels, chat } from 'openmodelkit';

const { models } = await listModels({ provider: 'ollama', free: true });
const model = models[0].id || models[0].name;

const reply = await chat({
  provider: 'ollama',
  model,
  prompt: 'Say hello in one sentence',
});

console.log(`Model: ${model}`);
console.log(reply);
```

---

## Providers

| Provider | Usage |
| --- | --- |
| Ollama | `provider: 'ollama'` |
| NVIDIA | `provider: 'nvidia'` |

---

## Model filters

### Ollama

| Filter | Values | Description |
| --- | --- | --- |
| `free` | `true` | Free models only |
| `premium` | `true` | Premium models only |
| `category` | `all` · `free` · `cloud` · `embedding` · `vision` · `tools` · `thinking` | Filter by model type |
| `order` | `popular` · `newest` | Sort order |
| `page` | number | Page number |
| `limit` | number | Results per page |

```js
import { listModels } from 'openmodelkit';

await listModels({ provider: 'ollama', free: true });
await listModels({ provider: 'ollama', premium: true });
await listModels({ provider: 'ollama', category: 'vision' });
await listModels({ provider: 'ollama', category: 'embedding' });
await listModels({ provider: 'ollama', category: 'tools' });
await listModels({ provider: 'ollama', category: 'thinking' });
await listModels({ provider: 'ollama', category: 'cloud' });
await listModels({
  provider: 'ollama',
  category: 'all',
  order: 'newest',
  page: 1,
  limit: 20,
});
```

### NVIDIA

| Filter | Values | Description |
| --- | --- | --- |
| `free` | `true` | Free endpoint models only |
| `premium` | `true` | Partner / premium models only |
| `page` | number | Page number |
| `limit` | number | Results per page |

```js
import { listModels } from 'openmodelkit';

await listModels({ provider: 'nvidia', free: true });
await listModels({ provider: 'nvidia', premium: true });
await listModels({ provider: 'nvidia', page: 1, limit: 50 });
```

---

## Authentication

Pass your provider API key when chatting (recommended for production):

```js
await chat({
  provider: 'ollama',
  model: 'gemma4',
  prompt: 'hi',
  apiKey: process.env.OLLAMA_API_KEY,
});
```

```js
await chat({
  provider: 'nvidia',
  model: 'meta/llama-3.1-8b-instruct',
  prompt: 'hi',
  apiKey: process.env.NVIDIA_API_KEY,
});
```

Or set environment variables:

```bash
export OLLAMA_API_KEY=your_ollama_key
export NVIDIA_API_KEY=your_nvidia_key
```

Never commit API keys to source control.

---

## CLI

```bash
# List models
npx openmodelkit models --provider ollama --free
npx openmodelkit models --provider ollama --premium
npx openmodelkit models --provider nvidia --free

# Chat
npx openmodelkit chat --provider ollama -m gemma4 "Say hello"
npx openmodelkit chat --provider nvidia -m meta/llama-3.1-8b-instruct "Say hello"

# Help
npx openmodelkit help
```

---

## API overview

| Export | Purpose |
| --- | --- |
| `listModels(options)` | List models with provider filters |
| `chat(options)` | Send a prompt and get a response |
| `listProviders(options)` | List available providers |
| `OpenModelKit` | Reusable client for repeated calls |
| `OpenModelKitError` | Structured error (`message`, `code`, `status`) |

TypeScript types are included.

---

## Requirements

- Node.js **18+** (native `fetch`)
- A valid provider API key when the upstream service requires one

---

## Author

Built and maintained by **[Aakash Chhoker](https://github.com/aakashchhoker)**.

- GitHub: [github.com/aakashchhoker](https://github.com/aakashchhoker)
- Package: [npmjs.com/package/openmodelkit](https://www.npmjs.com/package/openmodelkit)
- Repository: [github.com/aakashchhoker/openmodelkit](https://github.com/aakashchhoker/openmodelkit)

---

## License

[MIT](./LICENSE)
