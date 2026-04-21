// Rule shape:
//   { id, label, category, severity, pattern?, check?, onlyIfMissing?, minChars? }
// - category: "security" | "quality" | "completeness" | "cost"
// - severity: "error" | "warn" | "info"
// - pattern: regex; match count + samples produced automatically.
// - check: (prompt, ctx) => { count, samples, detail? } | null; custom logic.
// - onlyIfMissing: when true + pattern, issue fires if pattern is NOT found.
// - minChars: skip rule if prompt shorter than this (avoids noise on tiny prompts).

const CATEGORIES = ["security", "quality", "completeness", "cost"];

const RULES = [
  // ── SECURITY ─────────────────────────────────────────────────────────
  {
    id: "prompt-injection",
    label: "Prompt injection phrasing",
    category: "security",
    severity: "error",
    pattern:
      /\b(ignore (all |the |any |your |above |previous |prior )*(prior |earlier |previous |above |system )?(instruction|prompt|rule|directive)s?|disregard (all|the|any|your|above|previous)|forget (all|what|your|previous|above|everything)|new instructions?:|instead,?\s*(do|respond|say|output))/gi,
  },
  {
    id: "jailbreak-pattern",
    label: "Jailbreak pattern",
    category: "security",
    severity: "error",
    pattern:
      /\b(DAN mode|developer mode|jailbreak|pretend (you are|to be) (not |no longer )|without (restriction|filter|safety|limit|guardrail)s?|no (restriction|rule|filter|limit|ethic|moral|guardrail)s?|act as if you have no (restriction|rule|filter|limit))/gi,
  },
  {
    id: "secret-in-prompt",
    label: "API key / secret detected",
    category: "security",
    severity: "error",
    pattern:
      /(sk-ant-[a-zA-Z0-9_\-]{20,}|sk-[a-zA-Z0-9]{20,}|gsk_[a-zA-Z0-9]{30,}|AKIA[0-9A-Z]{16}|gh[pousr]_[a-zA-Z0-9]{30,}|xox[baprs]-[a-zA-Z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/g,
  },
  {
    id: "pii-in-prompt",
    label: "PII detected (email / phone / SSN / card)",
    category: "security",
    severity: "error",
    pattern:
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\b\d{3}-\d{2}-\d{4}\b|\b\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b|\b(?:\d[ -]?){13,16}\b)/g,
  },
  {
    id: "context-injection-boundary",
    label: "Untrusted input without clear boundary",
    category: "security",
    severity: "warn",
    check: (prompt) => {
      const hasUserMarker =
        /\b(user (input|said|message|says)|input:|user:|the following (text|input|message))/i.test(
          prompt,
        );
      const hasDelimiter = /```|"""|---|<\/?(input|user|data)>/.test(prompt);
      if (hasUserMarker && !hasDelimiter) {
        return {
          count: 1,
          samples: ["user input referenced without delimiter"],
        };
      }
      return null;
    },
  },

  // ── QUALITY ──────────────────────────────────────────────────────────
  {
    id: "clarity-vague-terms",
    label: "Vague quality terms",
    category: "quality",
    severity: "warn",
    pattern:
      /\b(good|better|best|appropriate|reasonable|properly|nicely|well(?!-)|clean|nice|decent|adequate|suitable)\b/gi,
  },
  {
    id: "verbosity-sentence-length",
    label: "Long sentences (>40 words)",
    category: "quality",
    severity: "warn",
    minChars: 60,
    check: (prompt) => {
      const sentences = prompt
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const long = sentences.filter(
        (s) => s.split(/\s+/).filter(Boolean).length > 40,
      );
      if (!long.length) return null;
      return {
        count: long.length,
        samples: long.slice(0, 3).map((s) => s.slice(0, 60) + "…"),
      };
    },
  },
  {
    id: "verbosity-redundancy",
    label: "Repeated phrases",
    category: "quality",
    severity: "warn",
    minChars: 80,
    check: (prompt) => {
      const words = prompt.toLowerCase().match(/[a-z]{4,}/g) || [];
      const freq = {};
      for (const w of words) freq[w] = (freq[w] || 0) + 1;
      const repeats = Object.entries(freq)
        .filter(([, c]) => c >= 4)
        .sort((a, b) => b[1] - a[1]);
      if (!repeats.length) return null;
      return {
        count: repeats.length,
        samples: repeats.slice(0, 3).map(([w, c]) => `${w}×${c}`),
      };
    },
  },
  {
    id: "actionability-weak-verbs",
    label: "Weak action verbs",
    category: "quality",
    severity: "warn",
    pattern:
      /\b(try to|attempt to|consider|might want to|think about|may want to|feel free to|you could|if possible)\b/gi,
  },
  {
    id: "consistency-terminology",
    label: "Mixed terminology for same concept",
    category: "quality",
    severity: "info",
    minChars: 80,
    check: (prompt) => {
      const p = prompt.toLowerCase();
      const pairs = [
        ["user", "customer"],
        ["user", "client"],
        ["function", "method"],
        ["array", "list"],
        ["object", "dict"],
        ["delete", "remove"],
      ];
      const hits = pairs.filter(
        ([a, b]) =>
          new RegExp(`\\b${a}s?\\b`).test(p) &&
          new RegExp(`\\b${b}s?\\b`).test(p),
      );
      if (!hits.length) return null;
      return {
        count: hits.length,
        samples: hits.map(([a, b]) => `${a} / ${b}`),
      };
    },
  },
  {
    id: "structure-sections",
    label: "Long prompt with no section structure",
    category: "quality",
    severity: "info",
    minChars: 300,
    check: (prompt) => {
      const hasStructure = /^(#{1,6} |\*\s|\-\s|\d+\.\s|[A-Z][A-Z ]{3,}:)/m.test(
        prompt,
      );
      return hasStructure
        ? null
        : { count: 1, samples: ["no headings, bullets, or numbered sections"] };
    },
  },

  // ── COMPLETENESS ─────────────────────────────────────────────────────
  {
    id: "role-clarity",
    label: "No role / persona set",
    category: "completeness",
    severity: "info",
    minChars: 100,
    pattern: /\b(you are|act as|your role|behave as|respond as|assume the role)\b/i,
    onlyIfMissing: true,
  },
  {
    id: "output-format-missing",
    label: "No output format specified",
    category: "completeness",
    severity: "warn",
    minChars: 80,
    pattern:
      /\b(json|markdown|csv|xml|yaml|table|bullet|list|format|schema|structure|plain text|one line)\b/i,
    onlyIfMissing: true,
  },
  {
    id: "hallucination-risk",
    label: "Factual ask without grounding / fallback",
    category: "completeness",
    severity: "warn",
    minChars: 60,
    check: (prompt) => {
      const isFactual = /\b(what (is|are|was|were)|how many|when did|who (is|was|are)|list all|name the|explain)\b/i.test(
        prompt,
      );
      const hasGrounding = /\b(if you (don'?t|do not) know|do not (make up|invent|hallucinate)|only use (the )?(provided|given|source)|based on (the )?(provided|given|source|context|document|following)|cite (the )?source)\b/i.test(
        prompt,
      );
      if (isFactual && !hasGrounding) {
        return { count: 1, samples: ["factual ask, no grounding clause"] };
      }
      return null;
    },
  },
  {
    id: "completeness-edge-cases",
    label: "No edge-case / error handling guidance",
    category: "completeness",
    severity: "info",
    minChars: 120,
    pattern:
      /\b(edge case|error|empty|invalid|null|none|missing|what if|otherwise|fallback|handle|if (no|not|unable|unavailable))\b/i,
    onlyIfMissing: true,
  },
  {
    id: "specificity-examples",
    label: "No examples given",
    category: "completeness",
    severity: "info",
    minChars: 120,
    pattern: /\b(for example|e\.g\.|such as|like this|example:|sample:|for instance)\b/i,
    onlyIfMissing: true,
  },
  {
    id: "specificity-constraints",
    label: "No explicit constraints",
    category: "completeness",
    severity: "warn",
    minChars: 100,
    pattern:
      /\b(must|should|required|at most|at least|no more than|no less than|exactly|only|mandatory|never|always|within \d)\b/i,
    onlyIfMissing: true,
  },

  // ── COST ─────────────────────────────────────────────────────────────
  {
    id: "cost",
    label: "Token cost",
    category: "cost",
    severity: "info",
    check: (_prompt, ctx) => {
      if (!ctx || typeof ctx.tokens !== "number") return null;
      return {
        count: ctx.tokens,
        samples: [`~${ctx.tokens} tokens`],
        detail: { tokens: ctx.tokens },
      };
    },
  },
  {
    id: "cost-limit",
    label: "Exceeds token budget",
    category: "cost",
    severity: "warn",
    check: (_prompt, ctx) => {
      if (!ctx || typeof ctx.tokens !== "number" || !ctx.maxTokens) return null;
      if (ctx.tokens <= ctx.maxTokens) return null;
      const overPct = Math.round(
        ((ctx.tokens - ctx.maxTokens) / ctx.maxTokens) * 100,
      );
      return {
        count: 1,
        samples: [`${ctx.tokens} / ${ctx.maxTokens} tokens (+${overPct}%)`],
        detail: { tokens: ctx.tokens, limit: ctx.maxTokens, overPct },
      };
    },
  },
  {
    id: "politeness-bloat",
    label: "Politeness bloat",
    category: "cost",
    severity: "info",
    pattern:
      /\b(could you please kindly|would you be so kind as to|if you don'?t mind|if it'?s not too much trouble|please kindly|thank you so much|thanks in advance|i would (be )?(really )?appreciate|much appreciated)\b/gi,
  },

  // ── LEGACY (kept from v0.2) ──────────────────────────────────────────
  {
    id: "filler-preamble",
    label: "Filler preamble",
    category: "cost",
    severity: "info",
    pattern:
      /\b(i was wondering if|i would like to know|i want to ask|can you tell me|i need you to|please help me)\b/gi,
  },
  {
    id: "ai-self-reference",
    label: "Unnecessary AI self-reference",
    category: "quality",
    severity: "info",
    pattern: /\b(as an ai|as a language model|you are an ai|being an ai)\b/gi,
  },
  {
    id: "hedge-words",
    label: "Hedging",
    category: "quality",
    severity: "info",
    pattern: /\b(basically|actually|literally|honestly|essentially|just|simply|really)\b/gi,
  },
  {
    id: "double-negation",
    label: "Double negation",
    category: "quality",
    severity: "warn",
    pattern: /\b(not un|not in|cannot not)\w*/gi,
  },
  {
    id: "excessive-whitespace",
    label: "Excessive whitespace",
    category: "quality",
    severity: "info",
    pattern: /\s{2,}|\n{3,}/g,
  },
];

export function analyze(prompt, ctx = {}) {
  const issues = [];
  const len = prompt.length;

  for (const rule of RULES) {
    if (rule.minChars && len < rule.minChars) continue;

    let result = null;

    if (rule.check) {
      result = rule.check(prompt, ctx);
    } else if (rule.pattern) {
      if (rule.onlyIfMissing) {
        if (!rule.pattern.test(prompt)) {
          result = { count: 1, samples: [`no match for "${rule.id}"`] };
        }
      } else {
        const matches = [...prompt.matchAll(rule.pattern)];
        if (matches.length > 0) {
          result = {
            count: matches.length,
            samples: matches.slice(0, 3).map((m) => m[0]),
          };
        }
      }
    }

    if (!result) continue;

    issues.push({
      id: rule.id,
      label: rule.label,
      category: rule.category,
      severity: rule.severity,
      count: result.count,
      samples: result.samples,
      ...(result.detail ? { detail: result.detail } : {}),
    });
  }

  return issues;
}

export function summarize(issues) {
  const total = issues.length;
  const byCategory = {};
  const bySeverity = { error: 0, warn: 0, info: 0 };

  for (const cat of CATEGORIES) byCategory[cat] = [];
  for (const i of issues) {
    byCategory[i.category].push(i);
    bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
  }

  const categoryStats = CATEGORIES.map((cat) => ({
    category: cat,
    count: byCategory[cat].length,
    pct: total ? Math.round((byCategory[cat].length / total) * 100) : 0,
    issues: byCategory[cat],
  }));

  return { total, bySeverity, categoryStats };
}

export { CATEGORIES };
