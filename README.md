# OpenModelKit

Minimal **JS SDK + CLI** to list open models and chat with a model name + prompt.

Point it at a compatible HTTP API (see routes below). Zero runtime dependencies. Node.js **18+**.

```text
Your app / CLI  →  openmodelkit  →  API  →  Ollama / NVIDIA
```

## Install

```bash
npm install openmodelkit
```

CLI without install:

```bash
npx openmodelkit models --free
```

## SDK

```js
import { OpenModelKit, chat, listModels } from 'openmodelkit';

// One-liner
const reply = await chat({ model: 'gemma4', prompt: 'hi' });

// Client (reuse config)
const kit = new OpenModelKit({
  baseUrl: 'http://localhost:3000',
  apiKey: process.env.OLLAMA_API_KEY,
  provider: 'ollama',
});

const models = await kit.listModels({ free: true });
const result = await kit.chat({ model: 'gemma4', prompt: 'hi' });
```

Provider prefix (auto-selects route):

```js
await chat({
  model: 'nvidia:meta/llama-3.1-8b-instruct',
  prompt: 'hi',
  nvidiaApiKey: process.env.NVIDIA_API_KEY,
});
```

TypeScript types ship with the package (`index.d.ts`).

### Errors

Failed calls throw `OpenModelKitError` with:

| Field | Meaning |
| --- | --- |
| `message` | Human-readable reason |
| `status` | HTTP status when available |
| `code` | `INVALID_INPUT`, `TIMEOUT`, `NETWORK_ERROR`, `HTTP_401`, … |
| `body` | Parsed API error body when present |

## CLI

```bash
npx openmodelkit models --provider ollama --free
npx openmodelkit chat -m gemma4 "what is 2+2"
npx openmodelkit chat --provider nvidia -m meta/llama-3.1-8b-instruct "hi"
npx openmodelkit providers --json
npx openmodelkit version
```

Flags: `--provider`, `-m` / `--model`, `--free`, `--premium`, `--page`, `--limit`, `--base-url`, `--json`.

## Environment

| Variable | Purpose |
| --- | --- |
| `OPENMODELKIT_BASE_URL` | API base (default `http://localhost:3000`) |
| `OPENMODELKIT_PROVIDER` | Default provider (`ollama` \| `nvidia`) |
| `OPENMODELKIT_TIMEOUT_MS` | Request timeout (default `120000`) |
| `OLLAMA_API_KEY` | Sent as `X-API-Key` |
| `NVIDIA_API_KEY` | Sent as `X-NVIDIA-API-Key` |

## HTTP mapping

| Method | Path |
| --- | --- |
| `GET` | `/{provider}/models` |
| `POST` | `/{provider}/chat` `{ model, prompt, ... }` |
| `GET` | `/providers` |

## Backend requirement

This package is a **client**. Set `OPENMODELKIT_BASE_URL` to a server that implements the routes above.

## Publish (maintainers)

```bash
npm test
npm publish --access public
```

`prepublishOnly` runs the test suite before publish.

## Author

Built by **[Aakash Chhoker](https://github.com/aakashchhoker)**.

## License

MIT
# openmodelkit
