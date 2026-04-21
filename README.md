# promptlint

A Grammarly-style linter **for LLM prompts**. Point it at a prompt and it will:

1. Detect filler, redundant politeness, hedging, and other token-wasters using local regex rules (free, instant).
2. Ask a small LLM to rewrite the prompt so it uses fewer tokens while preserving exact intent.
3. Show you the token savings and an itemised list of every change, with reasons.

Works with **Anthropic**, **Groq** (free tier), and **Ollama** (fully local, no account).

---

## Why

Prompts written in natural English are full of phrases like *"Could you please kindly…"*, *"I was wondering if you could maybe…"*, *"as an AI language model…"*. They burn tokens and dilute the actual instruction. `promptlint` strips them without losing meaning — lowering cost and usually improving output quality.

---

## Install

```bash
git clone <your-fork-url> promptlint
cd promptlint
npm install
cp .env.example .env
```

Open `.env` and fill in credentials for at least one provider (see below).

---

## Providers

Pick one. All three produce the same output format.

### Ollama — fully free, local, no account

```bash
# 1. Install Ollama from https://ollama.com
# 2. Pull a model (qwen2.5:7b is a good default for this task)
ollama pull qwen2.5:7b

# 3. In .env:
PROVIDER=ollama
OLLAMA_MODEL=qwen2.5:7b
```

Model recommendations by RAM:

| RAM    | Model         |
|--------|---------------|
| 8 GB   | `phi3.5`      |
| 16 GB  | `qwen2.5:7b`  |
| 32 GB+ | `llama3.1:8b` |

### Groq — free tier, fast, API-based

```bash
# 1. Sign up at https://console.groq.com and grab an API key (free)
# 2. In .env:
PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
```

### Anthropic — paid, exact token counts

```bash
# 1. Get a key at https://console.anthropic.com
# 2. In .env:
PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
```

Only Anthropic gives **exact** token counts (via their count_tokens endpoint). Groq and Ollama use a character-based estimate, shown as `(est.)` in the output.

---

## Environment variables

Everything lives in a single `.env` file at the project root. Copy the template and edit:

```bash
cp .env.example .env
```

Full contents of `.env.example` — every variable the app reads:

```bash
# Default provider if --provider is not passed on the CLI
PROVIDER=ollama

# --- Anthropic (paid) ---
ANTHROPIC_API_KEY=sk-ant-xxxxx
ANTHROPIC_MODEL=claude-haiku-4-5-20251001

# --- Groq (free tier, fast) — get a key at https://console.groq.com ---
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

# --- Ollama (fully free, local) — install from https://ollama.com then: `ollama pull llama3.2` ---
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

### Reference

| Variable             | Required for      | Default                          | Description                                                                       |
|----------------------|-------------------|----------------------------------|-----------------------------------------------------------------------------------|
| `PROVIDER`           | —                 | `anthropic`                      | Which provider to use when `--provider` is not passed. One of `anthropic`, `groq`, `ollama`. |
| `ANTHROPIC_API_KEY`  | `anthropic`       | —                                | Your Anthropic API key. Get one at https://console.anthropic.com.                 |
| `ANTHROPIC_MODEL`    | `anthropic`       | `claude-haiku-4-5-20251001`      | Any Claude model ID. Haiku is cheapest and fine for rewriting.                    |
| `GROQ_API_KEY`       | `groq`            | —                                | Your Groq API key. Free tier at https://console.groq.com.                         |
| `GROQ_MODEL`         | `groq`            | `llama-3.3-70b-versatile`        | Any Groq-hosted model. Try `llama-3.1-8b-instant` for faster / cheaper.           |
| `OLLAMA_BASE_URL`    | `ollama`          | `http://localhost:11434`         | URL where Ollama is running. Change only if remote or non-default port.           |
| `OLLAMA_MODEL`       | `ollama`          | `llama3.2`                       | Any pulled Ollama model (`ollama list`). `qwen2.5:7b` is recommended.             |

Rules of thumb:

- You only need credentials for the provider(s) you'll actually use. Fill one, leave the others blank.
- CLI flags win over env vars: `--provider groq --model llama-3.1-8b-instant` overrides `PROVIDER`/`GROQ_MODEL` for that invocation.
- **Never commit `.env`.** It's already in `.gitignore`. If a key leaks, rotate it at the provider console immediately.

---

## Usage

```bash
# Inline prompt
node src/index.js "Could you please kindly help me sort a list, I was wondering if you could maybe show me a few examples"

# From a file
node src/index.js --file my_prompt.txt

# Piped
cat my_prompt.txt | node src/index.js

# Override provider / model per-call
node src/index.js --provider groq "..."
node src/index.js --provider ollama --model qwen2.5:7b "..."

# Machine-readable JSON (for pipelines)
node src/index.js --json "..." > result.json
```

### Example output

```
Provider: ollama  Model: qwen2.5:7b

── ORIGINAL ─────────────────────────────────────────
Could you please kindly help me sort a list of numbers,
I was wondering if you could maybe show me a few examples

Tokens: 29 (est.)

── HEURISTIC ISSUES ─────────────────────────────────
  • Redundant politeness (1): Could you please kindly
  • Filler preamble (1): I was wondering if
  • Vague quantifier (1): a few

── REWRITTEN ────────────────────────────────────────
Sort a list of numbers. Show 3 examples.

Tokens: 10 (est.)  (-19, 65%)

── CHANGES ──────────────────────────────────────────
  • [politeness] Removed redundant request softeners
      − Could you please kindly help me
      + (removed — direct instruction)
  • [specificity] Replaced vague quantifier
      − a few examples
      + 3 examples
```

---

## Options

| Flag               | Description                                              |
|--------------------|----------------------------------------------------------|
| `-f, --file <p>`   | Read prompt from a file                                  |
| `-p, --provider`   | `anthropic` · `groq` · `ollama`                          |
| `-m, --model`      | Override the model for the chosen provider               |
| `--json`           | Emit machine-readable JSON                               |
| `-h, --help`       | Show help                                                |

---

## How it works

```
prompt
  │
  ├─► heuristics.js ─────► regex rules (local, free, instant)
  │
  └─► providers/<name>.js
        │
        ├─► rewrite       ─► LLM call with a strict meta-prompt (JSON response)
        └─► countTokens   ─► exact (Anthropic) or estimated (others)
```

The meta-prompt (`src/providers/_common.js`) instructs the model to preserve intent, constraints, examples, and named entities — then return a JSON object containing the rewritten prompt plus a list of changes with reasons.

---

## Project layout

```
src/
  index.js              CLI entry
  heuristics.js         Local regex rules
  providers/
    _common.js          Shared meta-prompt + JSON parser + token estimator
    anthropic.js        Claude (paid, exact token counts)
    groq.js             Groq (free tier)
    ollama.js           Ollama (local, no account)
    index.js            Provider factory + env config resolver
```

Only runtime dependency: `dotenv`.

---

## License

MIT
