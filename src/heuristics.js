const RULES = [
  {
    id: "redundant-politeness",
    label: "Redundant politeness",
    pattern: /\b(could you please kindly|would you be so kind as to|if you don't mind|if it's not too much trouble)\b/gi,
  },
  {
    id: "filler-preamble",
    label: "Filler preamble",
    pattern: /\b(i was wondering if|i would like to know|i want to ask|can you tell me|i need you to|please help me)\b/gi,
  },
  {
    id: "ai-self-reference",
    label: "Unnecessary AI self-reference",
    pattern: /\b(as an ai|as a language model|you are an ai|being an ai)\b/gi,
  },
  {
    id: "vague-quantifier",
    label: "Vague quantifier",
    pattern: /\b(some|a few|maybe|perhaps|possibly|somewhat|kind of|sort of)\b/gi,
  },
  {
    id: "hedge-words",
    label: "Hedging",
    pattern: /\b(basically|actually|literally|honestly|essentially|just|simply|really)\b/gi,
  },
  {
    id: "double-negation",
    label: "Double negation",
    pattern: /\b(not un|not in|cannot not)\w*/gi,
  },
  {
    id: "excessive-whitespace",
    label: "Excessive whitespace",
    pattern: /\s{2,}|\n{3,}/g,
  },
];

export function analyze(prompt) {
  const issues = [];
  for (const rule of RULES) {
    const matches = [...prompt.matchAll(rule.pattern)];
    if (matches.length > 0) {
      issues.push({
        id: rule.id,
        label: rule.label,
        count: matches.length,
        samples: matches.slice(0, 3).map((m) => m[0]),
      });
    }
  }
  return issues;
}
