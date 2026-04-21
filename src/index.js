#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config({ override: true });
import { readFileSync } from "node:fs";
import { analyze } from "./heuristics.js";
import { getProvider, resolveConfig, PROVIDER_NAMES } from "./providers/index.js";

function parseArgs(argv) {
  const args = { file: null, prompt: null, json: false, provider: null, model: null };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--file" || a === "-f") args.file = rest[++i];
    else if (a === "--json") args.json = true;
    else if (a === "--provider" || a === "-p") args.provider = rest[++i];
    else if (a === "--model" || a === "-m") args.model = rest[++i];
    else if (a === "--help" || a === "-h") args.help = true;
    else if (!args.prompt) args.prompt = a;
  }
  return args;
}

function printHelp() {
  console.log(`promptlint — optimize LLM prompts for tokens and clarity

Usage:
  promptlint "<prompt text>"
  promptlint --file path/to/prompt.txt
  cat prompt.txt | promptlint
  promptlint --provider groq "<prompt>"
  promptlint --provider ollama --model llama3.2 "<prompt>"
  promptlint --json "<prompt>"

Options:
  -f, --file <path>       Read prompt from a file
  -p, --provider <name>   LLM provider: ${PROVIDER_NAMES.join(", ")} (default: anthropic)
  -m, --model <name>      Override the model for the chosen provider
      --json              Emit machine-readable JSON
  -h, --help              Show this help

Env (.env):
  PROVIDER                 Default provider if --provider omitted
  ANTHROPIC_API_KEY        Required for anthropic
  ANTHROPIC_MODEL          Optional (default: claude-haiku-4-5-20251001)
  GROQ_API_KEY             Required for groq — free tier at console.groq.com
  GROQ_MODEL               Optional (default: llama-3.3-70b-versatile)
  OLLAMA_BASE_URL          Optional (default: http://localhost:11434)
  OLLAMA_MODEL             Optional (default: llama3.2)
`);
}

async function readStdin() {
  if (process.stdin.isTTY) return null;
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text || null;
}

async function resolvePrompt(args) {
  if (args.file) return readFileSync(args.file, "utf8").trim();
  if (args.prompt) return args.prompt;
  return await readStdin();
}

function pct(original, optimized) {
  if (original === 0) return 0;
  return Math.round(((original - optimized) / original) * 100);
}

function renderHuman(out) {
  const { original, rewritten, issues, tokensBefore, tokensAfter, changes, notes, providerName, model, tokenCountExact } = out;
  const saved = tokensBefore - tokensAfter;
  const pctSaved = pct(tokensBefore, tokensAfter);
  const tokenMark = tokenCountExact ? "" : " (est.)";

  console.log(`\nProvider: ${providerName}  Model: ${model}`);

  console.log("\n── ORIGINAL ─────────────────────────────────────────");
  console.log(original);
  console.log(`\nTokens: ${tokensBefore}${tokenMark}`);

  console.log("\n── HEURISTIC ISSUES ─────────────────────────────────");
  if (issues.length) {
    for (const i of issues) {
      console.log(`  • ${i.label} (${i.count}): ${i.samples.join(", ")}`);
    }
  } else {
    console.log("  (none)");
  }

  console.log("\n── REWRITTEN ────────────────────────────────────────");
  console.log(rewritten);
  console.log(
    `\nTokens: ${tokensAfter}${tokenMark}  (${saved >= 0 ? "-" : "+"}${Math.abs(saved)}, ${pctSaved}%)`,
  );

  if (changes?.length) {
    console.log("\n── CHANGES ──────────────────────────────────────────");
    for (const c of changes) {
      console.log(`  • [${c.type}] ${c.why}`);
      if (c.before) console.log(`      − ${c.before}`);
      if (c.after) console.log(`      + ${c.after}`);
    }
  }

  if (notes) {
    console.log("\n── NOTES ────────────────────────────────────────────");
    console.log(notes);
  }
  console.log("");
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) return printHelp();

  const prompt = await resolvePrompt(args);
  if (!prompt) {
    printHelp();
    process.exit(1);
  }

  const providerName = args.provider || process.env.PROVIDER || "anthropic";
  const provider = getProvider(providerName);
  const config = resolveConfig(provider);
  if (args.model) config.model = args.model;

  const issues = analyze(prompt);
  const [tokensBefore, rewriteResult] = await Promise.all([
    provider.countTokens({ ...config, text: prompt }),
    provider.rewrite({ ...config, prompt }),
  ]);
  const tokensAfter = await provider.countTokens({
    ...config,
    text: rewriteResult.rewritten,
  });

  const output = {
    providerName: provider.name,
    model: config.model,
    tokenCountExact: !!provider.tokenCountExact,
    original: prompt,
    rewritten: rewriteResult.rewritten,
    issues,
    tokensBefore,
    tokensAfter,
    changes: rewriteResult.changes || [],
    notes: rewriteResult.notes || "",
  };

  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    renderHuman(output);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
