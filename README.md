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
