#!/usr/bin/env node
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { OpenModelKit, OpenModelKitError } from './client.js';

const { version: VERSION } = createRequire(import.meta.url)('../package.json');

function printHelp() {
  console.log(`openmodelkit v${VERSION}

Usage:
  openmodelkit models [options]
  openmodelkit chat -m <model> [options] <prompt...>
  openmodelkit providers [options]
  openmodelkit version
  openmodelkit help

Options:
  --provider <name>   ollama | nvidia (default: OPENMODELKIT_PROVIDER or ollama)
  -m, --model <id>    Model id (supports nvidia:org/model)
  --free              Free models only
  --premium           Premium models only
  --page <n>          Page number
  --limit <n>         Page size
  --base-url <url>    API base URL
  --json              Raw JSON output
  -h, --help          Help
  -V, --version       Version

Examples:
  openmodelkit models --provider ollama --free
  openmodelkit chat -m gemma4 "what is 2+2"
  openmodelkit chat --provider nvidia -m meta/llama-3.1-8b-instruct "hi"
`);
}

/**
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  const args = [...argv];
  const flags = {
    provider: undefined,
    model: undefined,
    free: false,
    premium: false,
    page: undefined,
    limit: undefined,
    baseUrl: undefined,
    json: false,
    help: false,
    version: false,
  };
  const positional = [];

  const need = (flag) => {
    const v = args.shift();
    if (v == null || v.startsWith('-')) {
      throw new Error(`Missing value for ${flag}`);
    }
    return v;
  };

  while (args.length) {
    const a = args.shift();
    switch (a) {
      case '-h':
      case '--help':
        flags.help = true;
        break;
      case '-V':
      case '--version':
        flags.version = true;
        break;
      case '--json':
        flags.json = true;
        break;
      case '--free':
        flags.free = true;
        break;
      case '--premium':
        flags.premium = true;
        break;
      case '--provider':
      case '-p':
        flags.provider = need(a);
        break;
      case '--model':
      case '-m':
        flags.model = need(a);
        break;
      case '--page':
        flags.page = Number(need(a));
        break;
      case '--limit':
        flags.limit = Number(need(a));
        break;
      case '--base-url':
        flags.baseUrl = need(a);
        break;
      default:
        if (a.startsWith('--provider=')) flags.provider = a.slice(11);
        else if (a.startsWith('--model=')) flags.model = a.slice(8);
        else if (a.startsWith('--base-url=')) flags.baseUrl = a.slice(11);
        else if (a.startsWith('-')) throw new Error(`Unknown option: ${a}`);
        else positional.push(a);
    }
  }

  return { flags, positional };
}

function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

function modelsList(data) {
  if (Array.isArray(data?.models)) return data.models;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

function printModels(data, json) {
  if (json) return printJson(data);
  const items = modelsList(data);
  if (!items.length) {
    console.log('No models found.');
    return;
  }
  for (const m of items) {
    const id = m.id || m.name || m.model || JSON.stringify(m);
    const pricing = m.pricing ? ` [${m.pricing}]` : '';
    const ctxVal = m.context_window || m.context_window_tokens;
    const ctx = ctxVal ? ` ctx=${ctxVal}` : '';
    console.log(`${id}${pricing}${ctx}`);
  }
  const p = data?.pagination;
  if (p) {
    console.error(`\npage ${p.page ?? '?'}/${p.totalPages ?? '?'} · total ${p.total ?? items.length}`);
  }
}

function chatText(data) {
  return (
    data?.message?.content ||
    data?.response ||
    data?.content ||
    data?.choices?.[0]?.message?.content ||
    (typeof data === 'string' ? data : null)
  );
}

function printChat(data, json) {
  if (json) return printJson(data);
  const text = chatText(data);
  if (text != null) console.log(text);
  else printJson(data);
}

export async function main(argv = process.argv.slice(2)) {
  let flags;
  let positional;
  try {
    ({ flags, positional } = parseArgs(argv));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  const command = (positional[0] || '').toLowerCase();
  const rest = positional.slice(1);

  if (flags.version || command === 'version') {
    console.log(VERSION);
    return;
  }
  if (!command || command === 'help' || flags.help) {
    printHelp();
    return;
  }

  const kit = new OpenModelKit({
    baseUrl: flags.baseUrl,
    provider: flags.provider,
  });

  try {
    if (command === 'models') {
      printModels(
        await kit.listModels({
          provider: flags.provider,
          free: flags.free || undefined,
          premium: flags.premium || undefined,
          page: Number.isFinite(flags.page) ? flags.page : undefined,
          limit: Number.isFinite(flags.limit) ? flags.limit : undefined,
        }),
        flags.json
      );
      return;
    }

    if (command === 'providers') {
      const data = await kit.listProviders();
      if (flags.json) return printJson(data);
      const list = Array.isArray(data?.providers)
        ? data.providers
        : Array.isArray(data)
          ? data
          : [];
      if (!list.length) return printJson(data);
      for (const p of list) console.log(typeof p === 'string' ? p : p.id || p.name);
      return;
    }

    if (command === 'chat') {
      if (!flags.model) {
        console.error('chat requires -m/--model');
        process.exitCode = 1;
        return;
      }
      const prompt = rest.join(' ').trim();
      if (!prompt) {
        console.error('chat requires a prompt');
        process.exitCode = 1;
        return;
      }
      printChat(
        await kit.chat({ model: flags.model, prompt, provider: flags.provider }),
        flags.json
      );
      return;
    }

    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 1;
  } catch (err) {
    if (err instanceof OpenModelKitError) {
      console.error(err.message);
      if (flags.json && err.body !== undefined) printJson(err.body);
    } else {
      console.error(err?.message || err);
    }
    process.exitCode = 1;
  }
}

const entry = process.argv[1] && pathToFileURL(process.argv[1]).href;
if (entry === import.meta.url) {
  main();
}
