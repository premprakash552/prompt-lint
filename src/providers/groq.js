import { META_PROMPT, USER_TEMPLATE, parseJsonish, estimateTokens } from "./_common.js";

async function rewrite({ apiKey, model, prompt }) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: META_PROMPT },
        { role: "user", content: USER_TEMPLATE(prompt) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return parseJsonish(data.choices[0].message.content);
}

async function countTokens({ text }) {
  return estimateTokens(text);
}

export default {
  name: "groq",
  defaultModel: "llama-3.3-70b-versatile",
  tokenCountExact: false,
  rewrite,
  countTokens,
};
