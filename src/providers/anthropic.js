import { META_PROMPT, USER_TEMPLATE, parseJsonish } from "./_common.js";

async function rewrite({ apiKey, model, prompt }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0,
      system: META_PROMPT,
      messages: [{ role: "user", content: USER_TEMPLATE(prompt) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return parseJsonish(text);
}

async function countTokens({ apiKey, model, text }) {
  const res = await fetch("https://api.anthropic.com/v1/messages/count_tokens", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: text }],
    }),
  });
  if (!res.ok) throw new Error(`count_tokens ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.input_tokens;
}

export default {
  name: "anthropic",
  defaultModel: "claude-haiku-4-5-20251001",
  tokenCountExact: true,
  rewrite,
  countTokens,
};
