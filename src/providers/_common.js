export const META_PROMPT = `You are a prompt optimizer. Your job is to rewrite a user's prompt so it uses fewer tokens while preserving the exact original intent and improving clarity for an LLM.

Rules:
- Preserve every constraint, example, format requirement, and named entity.
- Remove filler, redundant politeness, hedging, and AI self-references.
- Replace vague quantifiers with specific ones only if the original is unambiguous.
- Do not invent requirements that were not in the original.
- If the prompt is already optimal, return it unchanged.

Respond with ONLY a JSON object. No prose. No markdown fences. No explanation outside JSON.

Schema:
{
  "rewritten": string,
  "changes": [ { "type": string, "before": string, "after": string, "why": string } ],
  "notes": string
}`;

export const USER_TEMPLATE = (prompt) =>
  `Optimize this prompt:\n\n---\n${prompt}\n---`;

export function parseJsonish(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {}
    }
    throw new Error(`Model did not return valid JSON. Raw output:\n${text}`);
  }
}

export function estimateTokens(text) {
  return Math.max(1, Math.ceil((text || "").length / 4));
}
