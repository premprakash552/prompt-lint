import { META_PROMPT, USER_TEMPLATE, parseJsonish, estimateTokens } from "./_common.js";

async function ollamaFetch(url, init) {
  try {
    return await fetch(url, init);
  } catch (err) {
    throw new Error(
      `Cannot reach Ollama at ${url}. Is it running? Start with \`ollama serve\` or install from https://ollama.com. (${err.message})`,
    );
  }
}

async function rewrite({ baseUrl, model, prompt }) {
  const res = await ollamaFetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      options: { temperature: 0 },
      messages: [
        { role: "system", content: META_PROMPT },
        { role: "user", content: USER_TEMPLATE(prompt) },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 404 && /model .* not found/i.test(body)) {
      throw new Error(
        `Ollama model "${model}" is not installed. Pull it with:\n  ollama pull ${model}`,
      );
    }
    throw new Error(`Ollama ${res.status}: ${body}`);
  }
  const data = await res.json();
  return parseJsonish(data.message.content);
}

async function countTokens({ text }) {
  return estimateTokens(text);
}

export default {
  name: "ollama",
  defaultModel: "llama3.2",
  tokenCountExact: false,
  rewrite,
  countTokens,
};
